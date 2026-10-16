// Compares native shells (mygo, Wails v3) showing the same page: each opens a
// bare window on the solid app with ?auto=1, which runs the scenarios itself.
// CPU time and memory come from ps/footprint over the shell and the WebKit
// processes that appeared after it started.
//
//   node scripts/shells.ts [--runs 2] [--src real --n 1000] [--scenarios load,open,churn]

import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { marks, serve } from './serve.ts'

const { values: args } = parseArgs({ options: { runs: { type: 'string', default: '2' }, src: { type: 'string', default: 'real' }, n: { type: 'string', default: '1000' }, scenarios: { type: 'string' } } })
const SHELLS = ['mygo', 'wails']

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const cpuSeconds = (t: string) => t.split(':').reduce((s, p) => s * 60 + Number(p), 0)

function ps() {
  return execFileSync('ps', ['-A', '-o', 'pid=,rss=,time=,args='], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n').map((l) => {
    const [pid, rss, time, ...a] = l.trim().split(/\s+/)
    return { pid: Number(pid), rssMb: Number(rss) / 1024, cpuMs: cpuSeconds(time) * 1000, args: a.join(' ') }
  })
}
const webkit = (a: string) => /com\.apple\.WebKit\.(WebContent|GPU|Networking)/.test(a)
const footprint = (pid: number) => {
  try {
    return Number(/Footprint: (\d+) B/.exec(execFileSync('footprint', ['-f', 'bytes', String(pid)], { encoding: 'utf8' }))?.[1]) / 1048576
  }
  catch { return 0 }
}

const { url } = await serve(4321)
const results: any[] = []

for (let run = 0; run < Number(args.runs); run++) {
  for (const shell of (run % 2 ? [...SHELLS].reverse() : SHELLS)) {
    marks.length = 0
    const before = new Set(ps().filter(p => webkit(p.args)).map(p => p.pid))
    const bin = new URL(`../.build/shell-${shell}`, import.meta.url).pathname
    const page = `${url}/solid/?auto=1&n=${args.n}&img=1&src=${args.src}${args.scenarios ? `&scenarios=${args.scenarios}` : ''}`
    const child = spawn(bin, [page], { stdio: 'ignore' })
    const mine = () => ps().filter(p => p.pid === child.pid || (webkit(p.args) && !before.has(p.pid)))
    const snap = () => {
      const rows = mine()
      return { t: Date.now(), cpuMs: rows.reduce((s, r) => s + r.cpuMs, 0), rssMb: rows.reduce((s, r) => s + r.rssMb, 0), rows }
    }
    const t0 = Date.now()
    const series: ReturnType<typeof snap>[] = []
    let peakFootprint = 0
    let tick = 0
    while (!marks.some(m => m.name === 'done') && Date.now() - t0 < 150_000) {
      await sleep(500)
      series.push(snap())
      if (++tick % 6 === 0)
        peakFootprint = Math.max(peakFootprint, mine().reduce((s, r) => s + footprint(r.pid), 0))
    }
    const at = (name: string) => marks.find(m => m.name === name)?.t
    const cpuAt = (t?: number) => t === undefined ? Number.NaN : (series.findLast(s => s.t <= t) ?? series[0]).cpuMs
    const scen: Record<string, number> = {}
    for (const m of marks.filter(m => m.name.startsWith('start-'))) {
      const name = m.name.slice(6)
      scen[name] = cpuAt(at(`end-${name}`)) - cpuAt(m.t)
    }
    // Idle for 5s once done: what the app costs while only open.
    const idle0 = snap()
    await sleep(5000)
    const idle1 = snap()
    const settledFootprint = mine().reduce((s, r) => s + footprint(r.pid), 0)
    const peakRss = Math.max(...series.map(s => s.rssMb))
    const row = {
      shell, run,
      loadCpuMs: cpuAt(at('ready')) - 0,
      runCpuMs: cpuAt(at('done')) - cpuAt(at('ready')),
      wallMs: (at('done') ?? 0) - (at('ready') ?? 0),
      idleCpuPct: (idle1.cpuMs - idle0.cpuMs) / (idle1.t - idle0.t) * 100,
      peakRssMb: peakRss, peakFootprintMb: peakFootprint, settledFootprintMb: settledFootprint,
      shellRssMb: idle1.rows.find(r => r.pid === child.pid)?.rssMb,
      procs: idle1.rows.length,
      scen,
      errors: marks.filter(m => m.name.startsWith('error-')).map(m => m.name.slice(6)),
    }
    console.log(JSON.stringify(row))
    results.push(row)
    child.kill()
    await sleep(2000)
  }
}
writeFileSync(new URL('../results/shells-raw.json', import.meta.url), JSON.stringify(results, null, 2))
process.exit(0)
