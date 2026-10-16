// Turns raw runs into markdown tables: one column per framework, best value
// of each row in bold. Also runnable on its own: node scripts/report.ts results/raw-….json

import type { RunResult, ScenarioResult } from './run.ts'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

/** Scenarios whose samples are frame intervals rather than latencies. */
const FRAME_SCENARIOS = new Set(['scroll', 'burst'])

const LABELS: Record<string, string> = {
  load: '打开整个文件夹',
  resize: '缩略图尺寸滑块（全量重排）',
  filter: '评分筛选开/关',
  rate: '在格子上评分（单项更新）',
  select: '全选 / 取消全选',
  toggle: 'Cmd-点击切换单项选中',
  open: '打开/关闭预览',
  switch: '预览切换（方向键，逐帧）',
  delete: '预览中删除',
  stream: '扫描流式追加（每批 100 张）',
  tabs: '切换标签页（保持挂载）',
  churn: '预览开-切 10 张-关 循环',
  scroll: '滚动（匀速 + 甩动）',
  burst: '按住方向键连切（8ms/次）',
}

function quantile(values: number[], q: number) {
  if (!values.length)
    return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  return sorted[lo] + (sorted[Math.ceil(pos)] - sorted[lo]) * (pos - lo)
}
function median(values: number[]) {
  return quantile(values, 0.5)
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

function fmt(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '–'
}

interface Row {
  label: string
  values: number[]
  /** How each cell reads; defaults to the value itself. */
  cells?: string[]
  /** Whether a higher value is better (fps); otherwise lower is. */
  higher?: boolean
  digits?: number
}

function table(frameworks: string[], rows: Row[]) {
  const lines = [`| 指标 | ${frameworks.join(' | ')} |`, `|---|${frameworks.map(() => '---:').join('|')}|`]
  for (const row of rows) {
    const finite = row.values.filter(Number.isFinite)
    const best = row.higher ? Math.max(...finite) : Math.min(...finite)
    const cells = row.values.map((value, i) => {
      const cell = row.cells?.[i] ?? fmt(value, row.digits)
      // Within 3% of the best counts as a tie.
      const close = finite.length > 1 && Number.isFinite(value) && Math.abs(value - best) <= Math.abs(best) * 0.03
      return close ? `**${cell}**` : cell
    })
    lines.push(`| ${row.label} | ${cells.join(' | ')} |`)
  }
  return lines.join('\n')
}

function bundleSizes(frameworks: string[]) {
  return frameworks.map((fw) => {
    const dir = new URL(`../dist/${fw}/assets/`, import.meta.url).pathname
    try {
      return readdirSync(dir).filter(f => f.endsWith('.js')).reduce((sum, f) => sum + gzipSync(readFileSync(dir + f)).length, 0) / 1024
    }
    catch {
      return Number.NaN
    }
  })
}

/** report, report-cpu4x, report-headed…: one file per kind of run. */
export function reportName(meta: Record<string, any>) {
  return ['report', meta.source === 'real' && 'real', meta.cpuThrottling > 1 && `cpu${meta.cpuThrottling}x`, meta.headed && 'headed'].filter(Boolean).join('-')
}

export function report(meta: Record<string, any>, results: RunResult[]) {
  const frameworks = [...new Set(results.map(r => r.fw))]
  const out: string[] = []
  out.push(`# 框架基准：瀑布流 + 预览`)
  out.push('')
  out.push(`- 时间：${meta.date}（耗时 ${fmt(meta.durationS / 60)} 分钟）`)
  out.push(`- 机器：${meta.machine}；CPU 降速：${meta.cpuThrottling}x；${meta.headed ? '有界面（真实显示器）' : '无头'}`)
  out.push(`- 每个画廊 ${meta.photos} 张${meta.source === 'real' ? '（本机图库最近的照片，PhotoKit 导出的缩略图与预览图）' : ''}照片；每组 ${meta.runs} 轮，每轮全新页面，框架顺序轮换`)
  out.push(`- 版本：${Object.entries(meta.versions).map(([k, v]) => `${k} ${v}`).join('，')}`)
  if (meta.browserVersions)
    out.push(`- 浏览器：${Object.entries(meta.browserVersions).map(([k, v]) => `${k} ${v}`).join('，')}`)
  out.push('')
  out.push(`「打开整个文件夹」即一次载入 ${meta.photos} 张。`)
  out.push('')
  out.push('所有轮次的样本合并统计；**粗体**为该行最优（3% 以内算并列）。')
  out.push('')
  out.push('## 包体积（JS，gzip）')
  out.push('')
  out.push(table(frameworks, [{ label: 'KB', values: bundleSizes(frameworks) }]))

  const groups = [...new Set(results.map(r => `${r.browser}|${r.img}`))]
  for (const group of groups) {
    const [browser, img] = group.split('|')
    const runs = results.filter(r => `${r.browser}|${r.img}` === group)
    const byFw = frameworks.map(fw => runs.filter(r => r.fw === fw))
    const scenarios = Object.keys(runs[0].scenarios)
    const pooled = (name: string) => byFw.map(rs => rs.flatMap(r => r.scenarios[name]?.samples ?? []))

    out.push('')
    const hz = median(runs.map(r => r.hz))
    const frameMs = 1000 / hz
    const jankMs = frameMs * 1.5
    out.push(`## ${browser} · ${img === 'true' ? '真实图片' : '纯色块（只测框架）'} · ${fmt(hz, 0)}Hz`)

    out.push('')
    out.push('### 响应速度：同步工作时间（ms，越低越好）')
    out.push('')
    out.push('从触发操作到框架更新完 DOM、浏览器完成样式与布局（不含绘制）。均值（p95）；用均值是因为 WebKit 的计时精度只有 1ms。')
    out.push('')
    const latencyScenarios = scenarios.filter(s => !FRAME_SCENARIOS.has(s) && s !== 'churn')
    const latency: Row[] = [{ label: '启动到首帧', values: byFw.map(rs => median(rs.map(r => r.bootMs))) }]
    for (const name of latencyScenarios) {
      const samples = pooled(name)
      const values = samples.map(mean)
      latency.push({
        label: LABELS[name] ?? name,
        values,
        digits: 2,
        cells: values.map((v, i) => `${fmt(v, 2)} (${fmt(quantile(samples[i], 0.95), 2)})`),
      })
    }
    out.push(table(frameworks, latency))

    out.push('')
    out.push('### 响应速度：到下一帧（ms）')
    out.push('')
    out.push(`中位数（p95）。受 vsync 限制，≈${fmt(frameMs)} 即“当帧完成”；明显更高说明掉了帧。`)
    out.push('')
    out.push(table(frameworks, latencyScenarios.map((name) => {
      const samples = byFw.map(rs => rs.flatMap(r => r.scenarios[name]?.frames ?? []))
      const values = samples.map(median)
      return { label: LABELS[name] ?? name, values, cells: values.map((v, i) => `${fmt(v)} (${fmt(quantile(samples[i], 0.95))})`) }
    })))

    out.push('')
    out.push('### 帧率')
    out.push('')
    const frames: Row[] = []
    for (const name of scenarios.filter(s => FRAME_SCENARIOS.has(s))) {
      const samples = pooled(name)
      frames.push({ label: `${LABELS[name]}：平均 FPS`, values: samples.map(s => 1000 / mean(s)), higher: true })
      frames.push({ label: `${LABELS[name]}：p95 帧间隔 ms`, values: samples.map(s => quantile(s, 0.95)) })
      frames.push({ label: `${LABELS[name]}：卡顿帧 %（>${fmt(jankMs)}ms）`, values: samples.map(s => (s.filter(v => v > jankMs).length / s.length) * 100) })
    }
    if (scenarios.includes('churn')) {
      const samples = pooled('churn')
      frames.push({ label: `${LABELS.churn}：每轮耗时 ms`, values: samples.map(median) })
    }
    out.push(table(frameworks, frames))

    const sumCpu = (pick: (r: ScenarioResult) => number | undefined) => byFw.map(rs => median(rs.map(r => scenarios.reduce((sum, s) => sum + (pick(r.scenarios[s]) ?? Number.NaN), 0))))
    out.push('')
    out.push('### CPU（ms，越低越好）')
    out.push('')
    out.push('页面渲染进程的 CPU 时间（含 JS、样式、布局、绘制、图片解码线程）；末尾为全部浏览器进程（含 GPU/合成）合计。')
    out.push('')
    const cpu: Row[] = scenarios.map(name => ({ label: LABELS[name] ?? name, values: byFw.map(rs => median(rs.map(r => r.scenarios[name].rendererCpuMs))), digits: 0 }))
    cpu.push({ label: '渲染进程合计', values: sumCpu(r => r.rendererCpuMs), digits: 0 })
    cpu.push({ label: '全部浏览器进程合计', values: sumCpu(r => r.cpuMs), digits: 0 })
    if (runs[0].scenarios[scenarios[0]].mainThreadMs !== undefined)
      cpu.push({ label: '主线程繁忙时间合计（CDP）', values: sumCpu(r => r.mainThreadMs), digits: 0 })
    out.push(table(frameworks, cpu))
    if (runs[0].longTasks) {
      out.push('')
      out.push(table(frameworks, [{ label: '长任务（>50ms）个数', values: byFw.map(rs => median(rs.map(r => (r.longTasks ?? []).length))), digits: 0 }]))
    }

    out.push('### 内存（越低越好）')
    out.push('')
    const points = Object.keys(runs[0].memory)
    const memory: Row[] = points.map(point => ({
      label: `渲染进程 RSS MB · ${point}`,
      values: byFw.map(rs => median(rs.map(r => r.memory[point].rssMb))),
      digits: 0,
    }))
    if (runs[0].memory.boot.footprintMb !== undefined) {
      for (const point of points)
        memory.push({ label: `渲染进程 footprint MB · ${point}`, values: byFw.map(rs => median(rs.map(r => r.memory[point].footprintMb!))), digits: 0 })
    }
    if (runs[0].memory.boot.heapMb !== undefined) {
      for (const point of points)
        memory.push({ label: `JS 堆 MB（GC 后）· ${point}`, values: byFw.map(rs => median(rs.map(r => r.memory[point].heapMb!))) })
      memory.push({ label: 'DOM 节点 · scroll 后', values: byFw.map(rs => median(rs.map(r => r.memory.scroll?.nodes ?? Number.NaN))), digits: 0 })
      memory.push({
        label: '循环后 JS 堆增长 MB（泄漏迹象）',
        values: byFw.map(rs => median(rs.map(r => r.memory.churn && r.memory.beforeChurn ? r.memory.churn.heapMb! - r.memory.beforeChurn.heapMb! : Number.NaN))),
        digits: 2,
      })
    }
    out.push(table(frameworks, memory))
  }
  return `${out.join('\n')}\n`
}

if (import.meta.main) {
  const file = process.argv[2]
  if (!file)
    throw new Error('Usage: node scripts/report.ts results/raw-….json')
  const { meta, results } = JSON.parse(readFileSync(file, 'utf8'))
  const markdown = report(meta, results)
  writeFileSync(file.replace(/raw-[^/]*\.json$/, `${reportName(meta)}.md`), markdown)
  console.log(markdown)
}
