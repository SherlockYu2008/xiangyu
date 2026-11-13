// 极简静态服务器：只用来预览 dist/ 打包结果，不参与开发流程。
// 用法：node scripts/serve-dist.mjs [端口]
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const port = Number(process.argv[2] || 4173)
const root = join(process.cwd(), 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let file = normalize(join(root, urlPath))
  if (!file.startsWith(root)) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(root, 'index.html') // SPA 兜底
  }
  try {
    const size = statSync(file).size
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': 'no-cache',
    })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`preview: http://127.0.0.1:${port}/  (root: ${root})`)
})
