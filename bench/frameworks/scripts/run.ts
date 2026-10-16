// Runs every scenario of src/shared/harness.ts against each built app, in
// fresh pages, and writes the raw numbers to results/.
//
//   node scripts/run.ts [--runs 5] [--n 5000] [--img 1|0|both]
//                       [--browsers wkwebview] [--fw react,solid,...]
//                       [--cpu 4]   (Chromium CPU throttling)
//                       [--headed]  (a window on screen: ProMotion runs at 120Hz)
//                       [--src real] (pictures exported by scripts/export-photos.swift)
//
// Browsers: by default the system's WKWebView, which Picnest runs in (mygo
// is not Electron), through scripts/wkdriver.swift: wkwebview with the 60fps
// cap turned off as Picnest does, wkwebview-60 with WebKit's default. Its
// window is always on screen. Playwright's chromium and webkit can still be
// named, for comparison.

import type { Browser, BrowserServer, CDPSession } from 'playwright'
import type { Samples } from '../src/shared/harness.ts'
import { execFileSync, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chromium, webkit } from 'playwright'
import { FRAMEWORKS } from './frameworks.ts'
import { report, reportName } from './report.ts'
import { serve } from './serve.ts'

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '5' },
    n: { type: 'string', default: '5000' },
    img: { type: 'string', default: 'both' },
    browsers: { type: 'string', default: 'wkwebview' },
    fw: { type: 'string', default: FRAMEWORKS.join(',') },
    cpu: { type: 'string', default: '1' },
    headed: { type: 'boolean', default: false },
    scenarios: { type: 'string' },
    purge: { type: 'boolean', default: false },
    src: { type: 'string', default: 'generated' },
  },
})

const SCENARIOS = args.scenarios?.split(',')
  ?? ['load', 'scroll', 'resize', 'filter', 'rate', 'select', 'toggle', 'open', 'switch', 'burst', 'delete', 'stream', 'tabs', 'churn']
/** After these, the run records memory: what a gallery holds once used. */
const MEMORY_AFTER = new Set(['load', 'scroll', 'tabs', 'churn', 'idle'])

export interface ScenarioResult extends Samples {
  /** CPU time of all the browser's processes (renderer, GPU, network, UI), in ms. */
  cpuMs: number
  /** CPU time of the page's renderer process alone, in ms. */
  rendererCpuMs: number
  /** Chromium only: time the renderer's main thread was busy, in ms. */
  mainThreadMs?: number
}

export interface Memory {
  /** Resident memory of the page's renderer process, in MB. */
  rssMb: number
  /**
   * The renderer's physical footprint, in MB: what Activity Monitor shows as
   * its memory. Unlike RSS it leaves out pages freed but not yet reclaimed.
   */
  footprintMb?: number
  /** The renderer's largest memory categories (footprint's), in MB. */
  categories?: Record<string, number>
  /** Chromium only, after a forced GC. */
  heapMb?: number
  nodes?: number
  listeners?: number
}

export interface RunResult {
  browser: string
  fw: string
  img: boolean
  run: number
  bootMs: number
  /** Measured animation-frame rate of the page. */
  hz: number
  scenarios: Record<string, ScenarioResult>
  memory: Record<string, Memory>
  longTasks?: number[]
}

interface Launched {
  name: string
  server?: BrowserServer
  browser?: Browser
}

/** A page under test, wherever it runs. */
interface Driver {
  /** The awaited value of a JavaScript expression in the page. */
  evaluate: <T>(js: string) => Promise<T>
  /** WKWebView only: empties WebKit's memory cache, as an app can. */
  purge?: () => Promise<void>
  /** Chromium only. */
  cdp?: CDPSession
  close: () => Promise<void>
}

const isWK = (browser: string) => browser.startsWith('wkwebview')

async function playwrightPage(launched: Launched, url: string, fw: string): Promise<Driver> {
  const context = await launched.browser!.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  page.on('pageerror', error => console.error(`  ! ${fw}: ${error.message}`))
  let cdp: CDPSession | undefined
  if (launched.name === 'chromium') {
    cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    if (args.cpu !== '1')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) })
  }
  await page.goto(url)
  if (args.headed)
    await page.bringToFront()
  return { evaluate: js => page.evaluate(js), cdp, close: () => context.close() }
}

/** The page in a WKWebView window, through scripts/wkdriver.swift (built into .build/). */
async function wkPage(browser: string, url: string): Promise<Driver> {
  const binary = new URL('../.build/wkdriver', import.meta.url).pathname
  const child = spawn(binary, [url, ...(browser === 'wkwebview' ? ['unlock'] : [])], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  const next = async () => JSON.parse((await lines.next()).value as string)
  await next() // ready
  return {
    async evaluate<T>(js: string) {
      child.stdin.write(`${JSON.stringify(js)}\n`)
      const reply = await next()
      if ('error' in reply)
        throw new Error(reply.error)
      return reply.value as T
    },
    async purge() {
      child.stdin.write('purge\n')
      await next()
    },
    async close() {
      child.stdin.end()
      child.kill()
    },
  }
}

interface ProcessRow {
  pid: number
  rssMb: number
  cpuMs: number
  renderer: boolean
}

/**
 * The browser's processes, with CPU time (ms) and memory. WebKit runs its
 * renderer, GPU and network processes as XPC services under launchd, so
 * they are found by install path rather than as children.
 */
function browserProcesses(browser: string): ProcessRow[] {
  // The system WebKit's processes, and the driver itself as its UI process.
  const install = isWK(browser) ? /com\.apple\.WebKit\.(?:WebContent|GPU)|\.build\/wkdriver/ : `ms-playwright/${browser === 'webkit' ? 'webkit-' : 'chromium-'}`
  return execFileSync('ps', ['-A', '-o', 'pid=,rss=,time=,args='], { encoding: 'utf8', maxBuffer: 1 << 24 })
    .trim()
    .split('\n')
    .filter(line => (typeof install === 'string' ? line.includes(install) : install.test(line)))
    .map((line) => {
      const [pid, rss, time, ...args] = line.trim().split(/\s+/)
      // [[h:]m]m:ss.cc
      const seconds = time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0)
      return { pid: Number(pid), rssMb: Number(rss) / 1024, cpuMs: seconds * 1000, renderer: /--type=renderer|WebContent/.test(args.join(' ')) }
    })
}

/** The physical footprint of process `pid`, in MB, and its largest categories. */
function footprint(pid: number) {
  try {
    const out = execFileSync('footprint', ['-f', 'bytes', String(pid)], { encoding: 'utf8' })
    const total = Number(/Footprint: (\d+) B/.exec(out)?.[1] ?? Number.NaN) / 1024 / 1024
    const categories = Object.fromEntries(out.split('\n')
      .map(line => /^\s*(\d+) B\s+\d+ B\s+\d+ B\s+\d+\s+(.+)$/.exec(line))
      .filter(m => m !== null)
      .map(m => [m[2].trim(), Number(m[1]) / 1024 / 1024] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6))
    return { total, categories }
  }
  catch {
    return { total: Number.NaN, categories: {} }
  }
}

/** CPU time of all the browser's processes, and CPU and memory of the page's renderer. */
function usage(browser: string, rendererPid: number) {
  const rows = browserProcesses(browser)
  const renderer = rows.find(row => row.pid === rendererPid)
  return {
    cpuMs: rows.reduce((sum, row) => sum + row.cpuMs, 0),
    rendererCpuMs: renderer?.cpuMs ?? Number.NaN,
    rendererRssMb: renderer?.rssMb ?? Number.NaN,
  }
}

/**
 * The page's renderer process: the one whose CPU time grows most while the
 * page spins for a moment (spare and other renderers stay idle).
 */
async function findRenderer(browser: string, page: Driver) {
  const before = new Map(browserProcesses(browser).map(row => [row.pid, row.cpuMs]))
  await page.evaluate('(() => { const end = performance.now() + 300; while (performance.now() < end); })()')
  const grown = browserProcesses(browser)
    .filter(row => row.renderer)
    .map(row => ({ pid: row.pid, grew: row.cpuMs - (before.get(row.pid) ?? 0) }))
    .sort((a, b) => b.grew - a.grew)
  return grown[0]?.pid ?? -1
}

async function mainThread(cdp: CDPSession) {
  const { metrics } = await cdp.send('Performance.getMetrics')
  const get = (name: string) => metrics.find(m => m.name === name)?.value ?? 0
  return {
    task: get('TaskDuration') * 1000,
    heapMb: get('JSHeapUsedSize') / 1024 / 1024,
    nodes: get('Nodes'),
    listeners: get('JSEventListeners'),
  }
}

async function runOnce(launched: Launched, baseUrl: string, fw: string, img: boolean, run: number): Promise<RunResult> {
  const url = `${baseUrl}/${fw}/?n=${args.n}&img=${img ? 1 : 0}${args.src === 'real' ? '&src=real' : ''}`
  const page = isWK(launched.name) ? await wkPage(launched.name, url) : await playwrightPage(launched, url, fw)
  const { cdp } = page
  const deadline = Date.now() + 30_000
  while (!await page.evaluate<boolean>('!!window.bench?.ready')) {
    if (Date.now() > deadline)
      throw new Error(`${fw} never got ready`)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  const bootMs = await page.evaluate<number>('window.bench.bootMs')
  const hz = await page.evaluate<number>('window.bench.refreshRate()')
  const rendererPid = await findRenderer(launched.name, page)

  async function memory(): Promise<Memory> {
    // Let image decodes and the like finish before reading.
    await new Promise(resolve => setTimeout(resolve, 500))
    if (cdp) {
      await cdp.send('HeapProfiler.collectGarbage')
      const m = await mainThread(cdp)
      return { rssMb: usage(launched.name, rendererPid).rendererRssMb, heapMb: m.heapMb, nodes: m.nodes, listeners: m.listeners }
    }
    const { total, categories } = footprint(rendererPid)
    return { rssMb: usage(launched.name, rendererPid).rendererRssMb, footprintMb: total, categories }
  }

  const result: RunResult = { browser: launched.name, fw, img, run, bootMs, hz, scenarios: {}, memory: {} }
  result.memory.boot = await memory()
  for (const name of SCENARIOS) {
    if (name === 'churn')
      result.memory.beforeChurn = await memory()
    const before = usage(launched.name, rendererPid)
    const mainBefore = cdp && await mainThread(cdp)
    const samples = await page.evaluate<Samples>(`window.bench.run(${JSON.stringify(name)})`)
    const after = usage(launched.name, rendererPid)
    const mainAfter = cdp && await mainThread(cdp)
    result.scenarios[name] = {
      ...samples,
      cpuMs: after.cpuMs - before.cpuMs,
      rendererCpuMs: after.rendererCpuMs - before.rendererCpuMs,
      mainThreadMs: mainBefore && mainAfter ? mainAfter.task - mainBefore.task : undefined,
    }
    if (MEMORY_AFTER.has(name))
      result.memory[name] = await memory()
    if (args.purge && page.purge && MEMORY_AFTER.has(name)) {
      await page.purge()
      result.memory[`${name}+purge`] = await memory()
    }
  }
  if (cdp)
    result.longTasks = await page.evaluate<number[]>('window.bench.longTasks')
  await page.close()
  return result
}

/** A run that stalls (a covered window stops animation frames) is dropped and tried again, once. */
async function runWithRetry(launched: Launched, baseUrl: string, fw: string, img: boolean, run: number): Promise<RunResult> {
  for (let attempt = 1; ; attempt++) {
    let timer: NodeJS.Timeout | undefined
    const stalled = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('stalled for 3 minutes')), 180_000)
    })
    try {
      return await Promise.race([runOnce(launched, baseUrl, fw, img, run), stalled])
    }
    catch (error) {
      if (attempt >= 2)
        throw error
      console.error(`  ! ${fw}: ${(error as Error).message}; trying again`)
      if (isWK(launched.name))
        execFileSync('pkill', ['-f', '.build/wkdriver'])
    }
    finally {
      clearTimeout(timer)
    }
  }
}

const browsers = args.browsers.split(',')
const frameworks = args.fw.split(',')
const imageModes = args.img === 'both' ? [true, false] : [args.img !== '0']
const runs = Number(args.runs)

const { url, close } = await serve()
const results: RunResult[] = []
const browserVersions: Record<string, string> = {}
const started = Date.now()
for (const name of browsers) {
  let launched: Launched = { name }
  if (isWK(name)) {
    browserVersions[name] = `system WebKit (macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()})`
  }
  else {
    const type = name === 'webkit' ? webkit : chromium
    // Full Chromium in its new headless mode renders as the real browser
    // does; the default headless shell is a different, lighter pipeline.
    const server = await type.launchServer({ headless: !args.headed, channel: name === 'chromium' ? 'chromium' : undefined })
    const browser = await type.connect(server.wsEndpoint())
    launched = { name, server, browser }
    browserVersions[name] = browser.version()
  }
  for (let run = 0; run < runs; run++) {
    for (const img of imageModes) {
      // Rotate the order each run so no framework always goes first (cold
      // caches) or last (a warm machine).
      const order = frameworks.map((_, i) => frameworks[(i + run) % frameworks.length])
      for (const fw of order) {
        process.stdout.write(`${name} run ${run + 1}/${runs} img=${img ? 1 : 0} ${fw.padEnd(15)}`)
        const t = Date.now()
        results.push(await runWithRetry(launched, url, fw, img, run))
        console.log(` ${((Date.now() - t) / 1000).toFixed(1)}s`)
      }
    }
  }
  await launched.browser?.close()
  await launched.server?.close()
}
close()

const meta = {
  date: new Date().toISOString(),
  durationS: (Date.now() - started) / 1000,
  photos: Number(args.n),
  runs,
  cpuThrottling: Number(args.cpu),
  headed: args.headed,
  source: args.src,
  machine: `${execFileSync('sysctl', ['-n', 'machdep.cpu.brand_string'], { encoding: 'utf8' }).trim()}, ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()}`,
  versions: Object.fromEntries(['react', 'solid-js', 'vue', 'babel-plugin-react-compiler', 'vite', 'playwright'].map(p => [
    p,
    JSON.parse(execFileSync('node', ['-p', `JSON.stringify(require('${p}/package.json').version)`], { encoding: 'utf8' })),
  ])),
  browserVersions,
}

const dir = new URL('../results/', import.meta.url).pathname
mkdirSync(dir, { recursive: true })
const stamp = meta.date.replace(/[:.]/g, '-')
writeFileSync(`${dir}raw-${stamp}.json`, JSON.stringify({ meta, results }))
const markdown = report(meta, results)
writeFileSync(`${dir}${reportName(meta)}.md`, markdown)
console.log(`\n${markdown}`)
