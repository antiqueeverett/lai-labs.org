// Release assets use the existing workflow token; no administrative API or new credential.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inventory, assertManifest, verifyLive, sha256, policy } from './release.mjs'

const apiRoot = `https://api.github.com/repos/${policy.repository}`
const headers = { ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
  Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
async function api(path, options = {}) {
  const response = await fetch(path.startsWith('https:') ? path : `${apiRoot}${path}`, {
    ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${path.split('?')[0]}`)
  return response
}
async function json(path, method, body) {
  return (await api(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json()
}
async function upload(release, name, bytes) {
  if (release.assets?.some(item => item.name === name)) {
    if (!(await asset(release, name)).equals(bytes)) throw new Error(`Existing draft asset conflicts: ${name}`)
    return
  }
  await api(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes,
  })
}
async function findRelease(tag) {
  const response = await fetch(`${apiRoot}/releases/tags/${tag}`, { headers, signal: AbortSignal.timeout(30_000) })
  if (response.ok) return response.json()
  if (response.status !== 404) throw new Error(`Release lookup: ${response.status}`)
  // An unpublished tag may only be discoverable in the authenticated draft listing.
  for (let page = 1; ; page++) {
    const releases = await json(`/releases?per_page=100&page=${page}`, 'GET')
    const found = releases.find(release => release.tag_name === tag)
    if (found) return found
    if (releases.length < 100) return null
  }
}
async function asset(release, name) {
  const item = release.assets.find(item => item.name === name)
  if (!item) throw new Error(`Missing release asset: ${name}`)
  return Buffer.from(await (await api(`/releases/assets/${item.id}`, { headers: { Accept: 'application/octet-stream' } })).arrayBuffer())
}
export function extractArchive(tar, directory) {
  const paths = execFileSync('tar', ['-tf', tar], { encoding: 'utf8' }).trim().split('\n')
  if (paths.some(path => path.startsWith('/') || path.includes('\\') || path.includes(':') || path.split('/').includes('..'))) throw new Error('Unsafe archive path')
  const listing = execFileSync('tar', ['-tvf', tar], { encoding: 'utf8' }).trim().split('\n')
  if (listing.some(line => !['-', 'd'].includes(line[0]))) throw new Error('Links and special files are forbidden in recovery archives')
  execFileSync('tar', ['-xf', tar, '-C', directory])
}
export async function createCandidate(tag, manifest, tar) {
  let release = await findRelease(tag)
  if (release && (!release.draft || release.target_commitish !== manifest.commit)) throw new Error('Refusing to change a published or conflicting release')
  release ||= await json('/releases', 'POST', {
    tag_name: tag, target_commitish: manifest.commit, name: tag, draft: true,
    body: `Production artifact for ${manifest.commit}. Acceptance is recorded in acceptance.json; see docs/operations.md.`,
  })
  await upload(release, 'release-bundle.tar', tar)
  await upload(release, 'release-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'))
  await upload(release, 'release-bundle.sha256', Buffer.from(sha256(tar) + '\n'))
  return release
}
export async function accept(release, manifest, evidence) {
  const record = { schema: 1, commit: manifest.commit, contentDigest: manifest.contentDigest,
    acceptedAt: new Date().toISOString(), workflowRun: process.env.GITHUB_RUN_ID, evidence }
  if (release.assets?.some(item => item.name === 'acceptance.json')) {
    const previous = JSON.parse(await asset(release, 'acceptance.json'))
    if (previous.commit !== manifest.commit || previous.contentDigest !== manifest.contentDigest) throw new Error('Existing acceptance record conflicts')
  } else await upload(release, 'acceptance.json', Buffer.from(JSON.stringify(record, null, 2) + '\n'))
  return json(`/releases/${release.id}`, 'PATCH', { draft: false, make_latest: 'false' })
}

async function main() {
  const command = process.argv[2]
  await mkdir('.release', { recursive: true })
  if (command === 'bootstrap') {
    const commit = 'ec3f5865ca27716ab8bfdd65548a855d3002d1a3'
    const tag = `production-${commit}-baseline`
    const existing = await findRelease(tag)
    if (existing && !existing.draft) {
      const release = existing
      if (release.prerelease) throw new Error('Original recovery baseline is not accepted')
      for (const name of ['release-bundle.tar', 'release-bundle.sha256', 'release-manifest.json', 'acceptance.json']) {
        if (!release.assets.some(item => item.name === name)) throw new Error(`Original recovery baseline missing ${name}`)
      }
      const manifest = JSON.parse(await asset(release, 'release-manifest.json'))
      const accepted = JSON.parse(await asset(release, 'acceptance.json'))
      if (manifest.commit !== commit || accepted.commit !== commit || accepted.contentDigest !== manifest.contentDigest) throw new Error('Original recovery baseline evidence conflicts')
      return
    }
    await mkdir('.release/bootstrap/site', { recursive: true })
    execFileSync('gh', ['run', 'download', '38022492493', '--repo', policy.repository, '--name', 'github-pages', '--dir', '.release/bootstrap'], { stdio: 'inherit' })
    extractArchive('.release/bootstrap/artifact.tar', '.release/bootstrap/site')
    const files = await inventory('.release/bootstrap/site')
    const manifest = { schema: 1, repository: policy.repository, commit, sourceCommit: policy.sourceCommit,
      legacy: true, canonicalUrl: 'https://www.lai-labs.org',
      routes: ['/', '/solutions/', '/industries/', '/impact/', '/partnerships/', '/about/', '/contact/'],
      files, contentDigest: sha256(JSON.stringify(files)),
      originalRun: '38022492493' }
    await verifyLive(policy.publicUrl, manifest)
    const release = await createCandidate(tag, manifest, await readFile('.release/bootstrap/artifact.tar'))
    await accept(release, manifest, { liveBytesAndHttp: 'pass', originalWorkflowRun: '38022492493',
      note: 'Original launch artifact preserved unchanged; no release.json existed in this artifact.' })
    console.log(`Preserved original launch: ${tag}`)
  } else if (command === 'prepare') {
    const manifest = JSON.parse(await readFile('release-manifest.json', 'utf8'))
    assertManifest(manifest, await inventory('dist'))
    execFileSync('tar', ['-cf', 'release-bundle.tar', '-C', 'dist', '.'])
    const tag = `production-${manifest.commit}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`
    const release = await createCandidate(tag, manifest, await readFile('release-bundle.tar'))
    await writeFile('.release/candidate.json', JSON.stringify({ id: release.id, tag }))
    if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `release_id=${release.id}\nrelease_tag=${tag}\n`, { flag: 'a' })
  } else if (command === 'accept') {
    const release = await json(`/releases/${process.env.RELEASE_ID}`, 'GET')
    const manifest = JSON.parse(await asset(release, 'release-manifest.json'))
    const evidence = JSON.parse(await readFile('live-verification.json', 'utf8'))
    if (evidence.result !== 'pass' || evidence.commit !== manifest.commit || evidence.contentDigest !== manifest.contentDigest) throw new Error('Live evidence does not match candidate')
    await accept(release, manifest, evidence)
    console.log(`Accepted ${release.tag_name}`)
  } else if (command === 'recover') {
    const tag = process.env.RECOVERY_RELEASE || ''
    if (!/^production-[a-f0-9]{40}-(?:baseline|\d+-\d+)$/.test(tag)) throw new Error('Invalid recovery release tag')
    const release = await json(`/releases/tags/${tag}`, 'GET')
    if (release.draft || release.prerelease) throw new Error('Recovery requires a published accepted release')
    const manifest = JSON.parse(await asset(release, 'release-manifest.json'))
    const acceptance = JSON.parse(await asset(release, 'acceptance.json'))
    if (acceptance.commit !== manifest.commit || acceptance.contentDigest !== manifest.contentDigest) throw new Error('Acceptance does not match artifact')
    const tar = await asset(release, 'release-bundle.tar')
    const expectedHash = (await asset(release, 'release-bundle.sha256')).toString().trim()
    if (sha256(tar) !== expectedHash) throw new Error('Recovery archive checksum mismatch')
    await writeFile('release-bundle.tar', tar)
    await mkdir('dist', { recursive: true })
    extractArchive('release-bundle.tar', 'dist')
    assertManifest(manifest, await inventory('dist'))
    await writeFile('release-manifest.json', JSON.stringify(manifest, null, 2) + '\n')
    console.log(`Restored accepted artifact ${tag} without npm or rebuilding`)
  } else throw new Error(`Unknown archive command: ${command}`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
