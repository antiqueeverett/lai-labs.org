import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { inventory, assertManifest, assertPromotion, currentFingerprint, sha256, policy, verifyLive } from '../scripts/release.mjs'
import { extractArchive } from '../scripts/archive.mjs'

const scratch = '.release/tests'
await mkdir(scratch, { recursive: true })

test('artifact integrity rejects changed, missing and additional files', async () => {
  const dir = await mkdtemp(join(scratch, 'integrity-'))
  try {
    await writeFile(join(dir, 'index.html'), 'accepted website')
    const files = await inventory(dir)
    const manifest = { schema: 1, repository: policy.repository, commit: 'a'.repeat(40), routes: ['/'], files, contentDigest: sha256(JSON.stringify(files)) }
    assert.doesNotThrow(() => assertManifest(manifest, files))
    await writeFile(join(dir, 'index.html'), 'wrong website')
    assert.throws(() => assertManifest(manifest, { ...files, 'index.html': sha256('wrong website') }), /differs/)
    assert.throws(() => assertManifest(manifest, {}), /differs/)
    assert.throws(() => assertManifest(manifest, { ...files, 'unexpected.js': sha256('extra') }), /differs/)
    assert.throws(() => assertManifest({ ...manifest, repository: 'wrong/repo' }, files), /repository/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('retained tar restores identical bytes without dependency installation', async () => {
  const dir = await mkdtemp(join(scratch, 'restore-'))
  try {
    await mkdir(join(dir, 'original'))
    await mkdir(join(dir, 'restored'))
    await writeFile(join(dir, 'original/index.html'), 'independent accepted fixture')
    await writeFile(join(dir, 'original/.nojekyll'), '')
    execFileSync('tar', ['-cf', join(dir, 'bundle.tar'), '-C', join(dir, 'original'), '.'])
    extractArchive(join(dir, 'bundle.tar'), join(dir, 'restored'))
    assert.deepEqual(await inventory(join(dir, 'restored')), await inventory(join(dir, 'original')))
    assert.throws(() => extractArchive(join(dir, 'bundle.tar'), join(dir, 'restored')), /empty real directory/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('recovery refuses parent traversal and symbolic links before extraction', async () => {
  const dir = await mkdtemp(join(scratch, 'unsafe-'))
  // Independent minimal USTAR fixtures, not archives produced by the implementation.
  function tarHeader(name, type, link = '') {
    const header = Buffer.alloc(512)
    header.write(name, 0, 100)
    header.write('0000644\0', 100)
    header.write('0000000\0', 108)
    header.write('0000000\0', 116)
    header.write('00000000000\0', 124)
    header.write('00000000000\0', 136)
    header.fill(32, 148, 156)
    header.write(type, 156)
    header.write(link, 157, 100)
    header.write('ustar\0', 257)
    header.write('00', 263)
    const checksum = [...header].reduce((sum, byte) => sum + byte, 0)
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148)
    return Buffer.concat([header, Buffer.alloc(1024)])
  }
  try {
    await mkdir(join(dir, 'out'))
    await writeFile(join(dir, 'traversal.tar'), tarHeader('../outside.txt', '0'))
    await writeFile(join(dir, 'link.tar'), tarHeader('escape', '2', '../outside.txt'))
    assert.throws(() => extractArchive(join(dir, 'traversal.tar'), join(dir, 'out')), /Unsafe archive path/)
    assert.throws(() => extractArchive(join(dir, 'link.tar'), join(dir, 'out')), /Links and special files/)
    assert.deepEqual(await inventory(join(dir, 'out')), {})
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('live verification rejects stale bytes, wrong origins and disguised 404s', async () => {
  let files, origin, corrupt = false, soft404 = false
  const server = createServer((request, response) => {
    let path = new URL(request.url, origin).pathname.slice(1)
    if (path === '__release_check_missing__') {
      response.writeHead(soft404 ? 200 : 404)
      return response.end('missing')
    }
    if (!path || path.endsWith('/')) path += 'index.html'
    if (!files[path] && files[`${path}/index.html`]) path += '/index.html'
    response.writeHead(files[path] ? 200 : 404)
    response.end(corrupt && path === 'app.js' ? 'stale application' : files[path])
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  const identity = { commit: 'a'.repeat(40), runId: 'independent-fixture' }
  files = { 'release.json': JSON.stringify(identity), 'app.js': 'accepted application' }
  for (const route of policy.routes) files[`${route.slice(1)}index.html`] = `<link rel="canonical" href="${origin}${route}">`
  const manifest = { ...identity, canonicalUrl: origin, routes: policy.routes, files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, sha256(bytes)])) }
  try {
    await verifyLive(origin, manifest, origin)
    // A historical release owns its route set, even when the current app has more routes.
    const currentFiles = files
    files = { 'release.json': currentFiles['release.json'], 'app.js': currentFiles['app.js'], 'index.html': currentFiles['index.html'] }
    await verifyLive(origin, { ...manifest, routes: ['/'], files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, sha256(bytes)])) }, origin)
    files = currentFiles
    corrupt = true
    await assert.rejects(verifyLive(origin, manifest, origin), /Live bytes differ: app.js/)
    corrupt = false
    await assert.rejects(verifyLive(origin, manifest, 'https://wrong.example'), /Wrong redirect origin/)
    soft404 = true
    await assert.rejects(verifyLive(origin, manifest, origin), /Unknown route returned 200/)
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('stale deployments and recovery over a newer live release are rejected', () => {
  const current = 'a'.repeat(40), newer = 'b'.repeat(40)
  assert.doesNotThrow(() => assertPromotion({ mode: 'deploy', requestedCommit: current, branchCommit: current }))
  assert.throws(() => assertPromotion({ mode: 'deploy', requestedCommit: current, branchCommit: newer }), /Stale/)
  const before = currentFingerprint({ commit: current, runId: '123', runAttempt: '1' }, { head_sha: current, run_attempt: 1, status: 'completed', conclusion: 'failure' })
  // An accepted retry can reuse identical release.json bytes. The producer state must fence it.
  const acceptedRetry = currentFingerprint({ commit: current, runId: '123', runAttempt: '1' }, { head_sha: current, run_attempt: 2, status: 'completed', conclusion: 'success' })
  const newRun = currentFingerprint({ commit: current, runId: '124', runAttempt: '1' }, { head_sha: current, run_attempt: 1, status: 'completed', conclusion: 'success' })
  assert.notEqual(before, acceptedRetry)
  assert.doesNotThrow(() => assertPromotion({ mode: 'recover', requestedCommit: current, branchCommit: current, liveIdentity: before, expectedCurrent: before }))
  for (const identity of [acceptedRetry, newRun]) assert.throws(() => assertPromotion({ mode: 'recover', requestedCommit: current, branchCommit: current, liveIdentity: identity, expectedCurrent: before }), /Recovery refused/)
  assert.throws(() => assertPromotion({ mode: 'recover', requestedCommit: current, branchCommit: current }), /Recovery refused/)
})
