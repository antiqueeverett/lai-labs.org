// Emit physical route entries: GitHub Pages has no SPA rewrite server.
export function pagesEntries() {
  return {
    name: 'github-pages-entries',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      for (const route of routes) {
        const canonical = `${policy.canonicalUrl}/${route}/`
        const source = String(html.source)
          .replace(/(<link rel="canonical" href=")[^"]+/, `$1${canonical}`)
          .replace(/(<meta property="og:url" content=")[^"]+/, `$1${canonical}`)
        this.emitFile({ type: 'asset', fileName: `${route}/index.html`, source })
      }
      this.emitFile({ type: 'asset', fileName: '404.html', source: html.source })
    },
  }
}

import { readFileSync } from 'node:fs'
const policy = JSON.parse(readFileSync(new URL('../deployment.json', import.meta.url), 'utf8'))
const declarations = [...readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8').matchAll(/<Route\b[^>]*>/g)]
export const routes = declarations.filter(([tag]) => /\bpath\s*=/.test(tag)).map(([tag]) => {
  const literal = tag.match(/\bpath="([^"]+)"/)
  if (!literal || !/^(?:[a-z-]+|\*)$/.test(literal[1])) throw new Error(`Unsupported static route declaration: ${tag}`)
  return literal[1]
}).filter(route => route !== '*')
const expected = policy.routes.filter(route => route !== '/').map(route => route.slice(1, -1))
if (JSON.stringify(routes) !== JSON.stringify(expected)) throw new Error('App routes differ from deployment.json; update the static hosting contract and independent route tests')
