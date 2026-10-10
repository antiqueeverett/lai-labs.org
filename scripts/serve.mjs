import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

const root = resolve('dist')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain' }
const server = createServer(async (req, res) => {
  try {
    let path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`)
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Outside root')
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html')
    const data = await readFile(path)
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end(await readFile(resolve(root, '404.html')))
  }
})
server.listen(4173, '127.0.0.1', () => console.log('Static production server: http://127.0.0.1:4173'))
