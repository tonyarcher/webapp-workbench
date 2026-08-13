import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// Resolve the built fetch handler relative to the working directory so the host
// works both when run from the app dir (local) and from the container workdir.
const { default: handler } = await import(
  pathToFileURL(path.join(process.cwd(), 'dist/server/server.js')).href
)

const port = Number(process.env.PORT ?? 3000)
const clientDir = path.join(process.cwd(), 'dist/client')

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.map': 'application/json',
}

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return false
  }
  const rel = pathname.replace(/^\/+/, '')
  const file = path.resolve(clientDir, rel)
  if (file !== clientDir && !file.startsWith(clientDir + path.sep)) return false
  try {
    const info = await stat(file)
    if (!info.isFile()) return false
    const data = await readFile(file)
    const ext = path.extname(file).toLowerCase()
    const cacheControl = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': cacheControl,
    })
    res.end(req.method === 'HEAD' ? undefined : data)
    return true
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

    if (await serveStatic(req, res, url)) return

    let body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
      })
    }

    const response = await handler.fetch(
      new Request(url, { method: req.method, headers: req.headers, body }),
    )

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    if (response.body) {
      await pipeline(Readable.fromWeb(response.body), res)
    } else {
      res.end()
    }
  } catch (err) {
    console.error(err)
    if (res.headersSent) {
      res.destroy()
    } else {
      res.writeHead(500)
      res.end('Internal Server Error')
    }
  }
})

server.listen(port, () => {
  console.log(`stock-game server listening on http://0.0.0.0:${port}`)
})
