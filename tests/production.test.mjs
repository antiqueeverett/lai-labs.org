import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const read = path => readFileSync(resolve('dist', path), 'utf8')

test('all seven public pages have deployable HTML and the correct canonical domain', () => {
  for (const route of ['', 'solutions/', 'industries/', 'impact/', 'partnerships/', 'about/', 'contact/']) {
    const html = read(`${route}index.html`)
    assert.ok(html.includes(`rel="canonical" href="https://www.lai-labs.org/${route}"`))
    for (const [, url] of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) {
      assert.ok(existsSync(resolve('dist', `.${url}`)), `Missing built asset ${url}`)
    }
    assert.doesNotMatch(html, /\/src\/|vercel\.app/)
  }
})

test('Pages domain, fallback, and static-only artifact contract are retained', () => {
  assert.equal(read('CNAME').trim(), 'www.lai-labs.org')
  assert.ok(existsSync('dist/.nojekyll'))
  assert.match(read('404.html'), /id="root"/)
  assert.ok(!existsSync('dist/api'))
  assert.ok(!existsSync('dist/src'))
  for (const name of readdirSync('dist', { recursive: true })) {
    assert.doesNotMatch(name, /(?:^|[\\/])(?:\.env|node_modules|\.claude|vercel\.json)(?:$|[\\/])/)
  }
})
