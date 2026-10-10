// Emit physical route entries: GitHub Pages has no SPA rewrite server.
export function pagesEntries() {
  return {
    name: 'github-pages-entries',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      for (const route of routes) {
        const canonical = `https://www.lai-labs.org/${route}/`
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
export const routes = [...readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  .matchAll(/<Route path="([a-z-]+)"/g)].map(match => match[1])
