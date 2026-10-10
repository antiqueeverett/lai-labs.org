import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCandidate, accept } from '../scripts/archive.mjs'

test('interrupted draft upload and publication resume without replacing evidence', async () => {
  const originalFetch = globalThis.fetch
  const files = new Map()
  let release = null, createCalls = 0, failUpload = true, failPublish = true
  const reply = (value, status = 200) => new Response(JSON.stringify(value), { status })
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    const method = options.method || 'GET'
    if (path.includes('/releases/tags/')) return reply({}, 404) // Draft tag not published yet.
    if (path.endsWith('/releases') && method === 'GET') return reply(release ? [release] : [])
    if (path.endsWith('/releases') && method === 'POST') {
      createCalls++
      release = { ...JSON.parse(options.body), id: 1, assets: [], upload_url: 'https://uploads.github.com/repos/example/site/releases/1/assets{?name}' }
      return reply(release, 201)
    }
    if (path.endsWith('/releases/1/assets') && method === 'POST') {
      const name = new URL(url).searchParams.get('name')
      if (name === 'release-manifest.json' && failUpload) { failUpload = false; return reply({}, 503) }
      const id = files.size + 1
      files.set(id, Buffer.from(options.body))
      release.assets.push({ id, name })
      return reply({ id, name }, 201)
    }
    const asset = path.match(/\/releases\/assets\/(\d+)$/)
    if (asset) return new Response(files.get(Number(asset[1])))
    if (path.endsWith('/releases/1') && method === 'PATCH') {
      if (failPublish) { failPublish = false; return reply({}, 503) }
      release.draft = false
      return reply(release)
    }
    throw new Error(`Unexpected test API: ${method} ${url}`)
  }
  const manifest = { commit: 'a'.repeat(40), contentDigest: 'fixture-digest' }
  try {
    await assert.rejects(createCandidate('production-fixture', manifest, Buffer.from('original tar')), /503/)
    assert.equal(release.assets.length, 1)
    await createCandidate('production-fixture', manifest, Buffer.from('original tar'))
    assert.equal(createCalls, 1)
    assert.equal(release.assets.length, 3)
    await assert.rejects(createCandidate('production-fixture', manifest, Buffer.from('different tar')), /conflicts/)
    await assert.rejects(accept(structuredClone(release), manifest, { test: 'pass' }), /503/)
    const recorded = Buffer.from(files.get(release.assets.find(item => item.name === 'acceptance.json').id))
    await accept(structuredClone(release), manifest, { test: 'pass' })
    assert.equal(release.draft, false)
    assert.equal(release.assets.length, 4)
    assert.ok(files.get(release.assets.find(item => item.name === 'acceptance.json').id).equals(recorded))
    await assert.rejects(createCandidate('production-fixture', manifest, Buffer.from('original tar')), /published/)
  } finally { globalThis.fetch = originalFetch }
})
