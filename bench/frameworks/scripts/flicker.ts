// Whether emptying WebKit's memory cache (as an app can, to give back the
// pictures scrolled past) makes the pictures on screen flicker. Scrolls the
// grid, lets it settle, snapshots it, empties the cache - or, as a control,
// does nothing - and snapshots it again over the next 800ms, comparing each
// to the first. Also reports the renderer's memory footprint around it.
//
//   node scripts/flicker.ts [fw]

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import sharp from 'sharp'
import { serve } from './serve.ts'

const fw = process.argv[2] ?? 'react'
const out = new URL('../results/flicker/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

function footprintMb(pid: number) {
  const text = execFileSync('footprint', ['-f', 'bytes', String(pid)], { encoding: 'utf8' })
  return Math.round(Number(/Footprint: (\d+) B/.exec(text)![1]) / 1024 / 1024)
}

/** Share of pixels that differ visibly between two snapshots. */
async function difference(a: string, b: string) {
  const [x, y] = await Promise.all([a, b].map(f => sharp(f).raw().toBuffer()))
  let changed = 0
  for (let i = 0; i < x.length; i += 4) {
    if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 30)
      changed++
  }
  return changed / (x.length / 4)
}

async function trial(url: string, purge: boolean) {
  const child = spawn(new URL('../.build/wkdriver', import.meta.url).pathname, [url, 'unlock'], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  const send = async (line: string) => {
    child.stdin.write(`${line}\n`)
    return JSON.parse((await lines.next()).value as string)
  }
  const js = (code: string) => send(JSON.stringify(code))
  const sleep = (ms: number) => js(`new Promise(r => setTimeout(r, ${ms}))`)
  const { pid } = JSON.parse((await lines.next()).value as string)
  while (!(await js('!!window.bench?.ready')).value)
    await sleep(50)
  await js(`window.bench.run('load')`)
  await js(`window.bench.run('scroll')`)
  const scrolled = footprintMb(pid)
  // Scroll to the middle and let every picture there decode and paint.
  await js(`document.querySelector('.gallery[data-tab="0"] .scroller').scrollTop = 30000`)
  await sleep(3000)
  const name = purge ? 'purge' : 'control'
  const base = `${out}${fw}-${name}-base.png`
  await send(`snapshot ${base}`)
  const before = footprintMb(pid)
  if (purge)
    await send('purge')
  const diffs: string[] = []
  let waited = 0
  for (const at of [0, 50, 100, 200, 400, 800]) {
    await sleep(at - waited)
    waited = at
    const file = `${out}${fw}-${name}-${at}ms.png`
    await send(`snapshot ${file}`)
    diffs.push(`${at}ms ${(await difference(base, file) * 100).toFixed(2)}%`)
  }
  await sleep(1000)
  const after = footprintMb(pid)
  child.stdin.end()
  child.kill()
  console.log(`${name.padEnd(7)} footprint after scrolling ${scrolled} MB, settled ${before} → ${after} MB; pixels changed: ${diffs.join(', ')}`)
}

const { url, close } = await serve()
const page = `${url}/${fw}/?n=5000&img=1`
await trial(page, false)
await trial(page, true)
close()
