// A static server for the built apps (/<fw>/) and the images (/img/).
// Run on its own (`bun run serve`) to try the apps by hand.

import type { AddressInfo } from 'node:net'
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
}

const root = new URL('..', import.meta.url).pathname

function resolve(pathname: string) {
  const path = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const file = path.startsWith('/img/') || path.startsWith('/real/') ? join(root, 'public', path) : join(root, 'dist', path)
  try {
    return statSync(file).isDirectory() ? join(file, 'index.html') : file
  }
  catch {
    return null
  }
}

export const marks: { name: string, t: number }[] = []

export function serve(port = 0): Promise<{ url: string, close: () => void }> {
  const server = createServer((req, res) => {
    // A shell's page reporting where it is in a run (see ?auto=1 in harness.ts).
    if (req.url?.startsWith('/mark')) {
      const name = new URL(req.url, 'http://x').searchParams.get('name') ?? ''
      marks.push({ name, t: Date.now() })
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }).end('ok')
      return
    }
    const file = resolve(new URL(req.url ?? '/', 'http://x').pathname)
    if (!file) {
      res.writeHead(404).end()
      return
    }
    // Images are cacheable as a real webview's file URLs are; each photo
    // still has its own URL, so each is fetched and decoded once.
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': file.endsWith('.jpg') ? 'max-age=3600' : 'no-store',
    })
    createReadStream(file).pipe(res)
  })
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      done({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

if (import.meta.main) {
  const { url } = await serve(4321)
  console.log(`Serving ${url}/<react|react-compiler|solid|vue>/?n=5000&img=1`)
}
