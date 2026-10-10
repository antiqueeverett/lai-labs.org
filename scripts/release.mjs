import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const policy = JSON.parse(await readFile(new URL('../deployment.json', import.meta.url), 'utf8'))
export const sha256 = data => createHash('sha256').update(data).digest('hex')

export async function inventory(directory) {
  const root = resolve(directory)
  const files = {}
  async function walk(path) {
    for (const name of (await readdir(path)).sort()) {
      const file = resolve(path, name)
      const info = await lstat(file)
      if (info.isSymbolicLink()) throw new Error(`Symbolic link forbidden: ${file}`)
      if (info.isDirectory()) await walk(file)
      else if (info.isFile()) files[relative(root, file).split(sep).join('/')] = sha256(await readFile(file))
      else throw new Error(`Unsupported file: ${file}`)
    }
  }
  await walk(root)
  return files
}

export function assertManifest(manifest, files) {
  if (manifest.schema !== 1 || !/^[a-f0-9]{40}$/.test(manifest.commit)) throw new Error('Invalid release identity')
  if (manifest.repository !== policy.repository) throw new Error('Wrong repository')
  if (!Array.isArray(manifest.routes) || !manifest.routes.includes('/') || manifest.routes.some(route => !/^\/(?:[a-z-]+\/)?$/.test(route))) throw new Error('Invalid archived route contract')
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) throw new Error('Artifact content differs from manifest')
  if (manifest.contentDigest !== sha256(JSON.stringify(files))) throw new Error('Invalid content digest')
}

export function assertPromotion({ mode, requestedCommit, branchCommit, liveIdentity, expectedCurrent }) {
  if (requestedCommit !== branchCommit) throw new Error('Stale workflow: deployment branch has advanced')
  if (mode === 'recover' && (!/^[a-f0-9]{40}:\d+:\d+$/.test(expectedCurrent || '') || liveIdentity !== expectedCurrent)) {
    throw new Error('Recovery refused: current live release does not match expected_current')
  }
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000), cache: 'no-store' })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

export async function verifyLive(base, manifest, expectedOrigin = policy.canonicalUrl) {
  const origin = new URL(base).origin
  const failures = []
  // Verify all deployed bytes, not just a mutable release.json marker. No form submissions.
  const entries = Object.entries(manifest.files)
  for (let offset = 0; offset < entries.length; offset += 6) {
    await Promise.all(entries.slice(offset, offset + 6).map(async ([path, digest]) => {
      const response = await fetch(`${origin}/${path}?release=${manifest.commit}`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
      if (!response.ok || sha256(Buffer.from(await response.arrayBuffer())) !== digest) failures.push(path)
    }))
  }
  if (failures.length) throw new Error(`Live bytes differ: ${failures.join(', ')}`)
  if (!manifest.legacy) {
    const identity = await getJson(`${origin}/release.json?release=${manifest.commit}`)
    if (identity.commit !== manifest.commit || identity.runId !== manifest.runId) throw new Error('Wrong live release identity')
  }
  for (const route of manifest.routes) {
    for (const path of new Set([route, route === '/' ? '/' : route.slice(0, -1)])) {
      const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
      if (response.status !== 200) throw new Error(`Route ${path}: ${response.status}`)
      const html = await response.text()
      if (!html.includes(`rel="canonical" href="${manifest.canonicalUrl}${route}"`)) throw new Error(`Wrong canonical: ${path}`)
      if (new URL(response.url).origin !== expectedOrigin) throw new Error(`Wrong redirect origin: ${response.url}`)
    }
  }
  const missing = await fetch(`${origin}/__release_check_missing__`, { signal: AbortSignal.timeout(30_000) })
  if (missing.status !== 404) throw new Error(`Unknown route returned ${missing.status}`)
}

async function main() {
  const [command, argument] = process.argv.slice(2)
  if (command === 'stamp') {
    const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const identity = { schema: 1, repository: policy.repository, commit, sourceCommit: policy.sourceCommit,
      runId: process.env.GITHUB_RUN_ID || 'local', runAttempt: process.env.GITHUB_RUN_ATTEMPT || '1',
      node: process.version, lockDigest: sha256(await readFile('package-lock.json')),
      canonicalUrl: policy.canonicalUrl, routes: policy.routes,
      leadershipProfiles: process.env.VITE_SHOW_LEADERSHIP_PROFILES === 'true', bookingEnabled: policy.bookingEnabled }
    await writeFile('dist/release.json', JSON.stringify(identity, null, 2) + '\n')
    const files = await inventory('dist')
    await writeFile('release-manifest.json', JSON.stringify({ ...identity, contentDigest: sha256(JSON.stringify(files)), files }, null, 2) + '\n')
  } else if (command === 'verify-artifact') {
    assertManifest(JSON.parse(await readFile('release-manifest.json', 'utf8')), await inventory(argument || 'dist'))
  } else if (command === 'verify-live') {
    const manifest = JSON.parse(await readFile('release-manifest.json', 'utf8'))
    await verifyLive(argument || policy.publicUrl, manifest)
    await writeFile('live-verification.json', JSON.stringify({ schema: 1, commit: manifest.commit, contentDigest: manifest.contentDigest,
      checkedAt: new Date().toISOString(), publicUrl: policy.publicUrl, result: 'pass' }, null, 2) + '\n')
  } else if (command === 'guard') {
    if (process.env.GITHUB_REF !== `refs/heads/${policy.branch}`) throw new Error('Only the deployment branch may publish')
    const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }
    const branch = await getJson(`https://api.github.com/repos/${policy.repository}/branches/${policy.branch}`, headers)
    const mode = process.env.RELEASE_MODE || 'deploy'
    const live = mode === 'recover' ? await getJson(`${policy.publicUrl}/release.json?guard=${Date.now()}`) : null
    assertPromotion({ mode, requestedCommit: process.env.GITHUB_SHA, branchCommit: branch.commit.sha,
      liveIdentity: live ? `${live.commit}:${live.runId}:${live.runAttempt}` : undefined, expectedCurrent: process.env.EXPECTED_CURRENT })
  } else throw new Error(`Unknown release command: ${command}`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
