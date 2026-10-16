// The in-page half of the benchmark: every framework's app registers its
// tabs here and the scenarios below drive the app through the DOM (clicks,
// key presses, input events, scrolling) exactly the same way for each.

import type { TabApi } from './types.ts'
import { makePhotos, useRealImages } from './data.ts'

const params = new URLSearchParams(location.search)
/**
 * Where the pictures come from: generated ones, or ("real") the ones
 * scripts/export-photos.swift exported from the Photos library.
 */
const SOURCE = params.get('src')
/** Photos per gallery; with real pictures, no more than were exported. */
export let PHOTO_COUNT = Number(params.get('n') ?? 5000)
let sourceReady = SOURCE !== 'real'
if (SOURCE === 'real') {
  void fetch('/real/manifest.json').then(r => r.json()).then((images) => {
    useRealImages(images)
    PHOTO_COUNT = Math.min(PHOTO_COUNT, images.length)
    sourceReady = true
  })
}
/** Whether tiles and the preview load real JPEGs, or draw flat colors. */
export const IMAGES = params.get('img') !== '0'
export const TAB_COUNT = 3

/** Resolves once the frame after this call has been produced (rAF, then a task after it). */
export function nextPaint(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => resolve(performance.now())
      channel.port2.postMessage(null)
    })
  })
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Forces style and layout, so any DOM work the framework left pending is paid for now. */
function flushLayout() {
  void document.documentElement.offsetHeight
}

/** Runs once tasks already queued (a scheduler's postMessage) have run. */
function afterQueuedTasks(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })
}

/** Frame latencies of the scenario running now; see measure. */
let frameSamples: number[] = []

/**
 * Runs `action` and returns its work time, in ms: until the framework's
 * update (sync, microtask or a queued task) has run and the browser has done
 * the style and layout it caused. Paint is left out: it is vsync-bound, so
 * would round every action to a frame. The time to the next frame is
 * recorded alongside, in frameSamples.
 */
async function measure(action: () => void): Promise<number> {
  await nextPaint()
  const start = performance.now()
  action()
  // React schedules its render task from a microtask; let that be queued
  // first so the hop below runs after it.
  await Promise.resolve()
  await afterQueuedTasks()
  flushLayout()
  const work = performance.now() - start
  frameSamples.push((await nextPaint()) - start)
  return work
}

/** Records the interval between animation frames until stopped. */
function recordFrames() {
  const intervals: number[] = []
  let last = performance.now()
  let running = true
  function tick(now: number) {
    if (!running)
      return
    intervals.push(now - last)
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return () => {
    running = false
    return intervals
  }
}

const longTasks: number[] = []
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      longTasks.push(entry.duration)
  }).observe({ type: 'longtask', buffered: true })
}
catch {
  // WebKit has no long task timing.
}

/**
 * Keeps decoded images alive for the preview (as the app's useDecodedImages
 * does), so a photo switched to paints on its first frame.
 */
export class ImageDecoder {
  private images = new Map<string, HTMLImageElement>()

  decode(src: string) {
    if (!src || this.images.has(src))
      return
    const image = new Image()
    image.src = src
    this.images.set(src, image)
    image.decode().catch(() => {})
  }

  retain(srcs: string[]) {
    for (const src of this.images.keys()) {
      if (!srcs.includes(src))
        this.images.delete(src)
    }
  }
}

// --- DOM helpers ---------------------------------------------------------

function gallery(tab = 0) {
  return document.querySelector<HTMLElement>(`.gallery[data-tab="${tab}"]`)!
}

function scroller(tab = 0) {
  return gallery(tab).querySelector<HTMLElement>('.scroller')!
}

/** Tiles of the tab fully inside its scroller's visible area, in DOM order. */
function tilesOnScreen(tab = 0) {
  const box = scroller(tab).getBoundingClientRect()
  return [...gallery(tab).querySelectorAll<HTMLElement>('.tile')].filter((tile) => {
    const r = tile.getBoundingClientRect()
    return r.top >= box.top && r.bottom <= box.bottom
  })
}

function key(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}

function setWidth(width: number, tab = 0) {
  const input = gallery(tab).querySelector<HTMLInputElement>('input.width')!
  input.value = String(width)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function click(el: Element | null, init: MouseEventInit = {}) {
  if (!el)
    throw new Error('Nothing to click')
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, ...init }))
}

function previewOpen() {
  return document.querySelector('.preview') !== null
}

/** Scrolls by `step` px every frame for `frames` frames, recording frame intervals. */
async function scrollFrames(el: HTMLElement, step: number, frames: number) {
  const stop = recordFrames()
  for (let i = 0; i < frames; i++) {
    el.scrollTop += step
    await new Promise(requestAnimationFrame)
  }
  await nextPaint()
  return stop()
}

// --- Scenarios -----------------------------------------------------------

export interface Samples {
  /** Per-action work times, or per-frame intervals for frame scenarios, in ms. */
  samples: number[]
  /** Per-action time to the next frame, in ms; empty for frame scenarios. */
  frames: number[]
  /** Total wall time of the scenario, in ms. */
  total: number
  extra?: Record<string, number>
}

async function timed(run: () => Promise<number[]>, extra?: () => Record<string, number>): Promise<Samples> {
  frameSamples = []
  const start = performance.now()
  const samples = await run()
  return { samples, frames: frameSamples, total: performance.now() - start, extra: extra?.() }
}

const tabs = new Map<number, TabApi>()
let mountedAt = 0

const scenarios: Record<string, () => Promise<Samples>> = {
  /** Opening a folder of PHOTO_COUNT photos. */
  load: () => timed(async () => [await measure(() => tabs.get(0)!.load(makePhotos(PHOTO_COUNT, 0, IMAGES)))]),

  /** Steady trackpad-like scroll, then a fling that jumps several screens a frame. */
  scroll: () => timed(async () => {
    const el = scroller()
    const steady = await scrollFrames(el, 40, 300)
    const fling = await scrollFrames(el, 1500, 60)
    el.scrollTop = 0
    await nextPaint()
    return [...steady, ...fling]
  }, () => ({ tilesMounted: gallery().querySelectorAll('.tile').length })),

  /** Dragging the thumbnail-size slider: every step relays out all photos. */
  resize: () => timed(async () => {
    const out: number[] = []
    for (const width of [160, 200, 240, 280, 320, 360, 300, 260, 220, 180, 240])
      out.push(await measure(() => setWidth(width)))
    return out
  }),

  /** Rating filter on and off: thousands of tiles leave and come back. */
  filter: () => timed(async () => {
    const out: number[] = []
    for (const f of ['4', 'all', '2', 'all', '5', 'all', '1', 'all'])
      out.push(await measure(() => click(gallery().querySelector(`button[data-filter="${f}"]`))))
    return out
  }),

  /** Rating one photo among thousands, from its tile. */
  rate: () => timed(async () => {
    const out: number[] = []
    const tiles = tilesOnScreen()
    for (let i = 0; i < 20; i++) {
      const id = tiles[i % tiles.length].dataset.photoId!
      const star = (i % 5) + 1
      out.push(await measure(() => click(gallery().querySelector(`.tile[data-photo-id="${id}"] button[data-star="${star}"]`))))
    }
    return out
  }),

  /** Select all, then clear: every mounted tile changes its look. */
  select: () => timed(async () => {
    const out: number[] = []
    for (let i = 0; i < 5; i++) {
      out.push(await measure(() => key('a', { metaKey: true })))
      out.push(await measure(() => key('Escape')))
    }
    return out
  }),

  /** Toggling single tiles into the selection with Cmd-click. */
  toggle: () => timed(async () => {
    const out: number[] = []
    const tiles = tilesOnScreen()
    for (let i = 0; i < 20; i++) {
      const id = tiles[i % tiles.length].dataset.photoId!
      out.push(await measure(() => click(gallery().querySelector(`.tile[data-photo-id="${id}"]`), { metaKey: true })))
    }
    key('Escape')
    await nextPaint()
    return out
  }),

  /** Opening the preview from a tile, then closing it. */
  open: () => timed(async () => {
    const opens: number[] = []
    const closes: number[] = []
    for (let i = 0; i < 10; i++) {
      const tiles = tilesOnScreen()
      opens.push(await measure(() => click(tiles[i % tiles.length].querySelector('.thumb'))))
      if (!previewOpen())
        throw new Error('Preview did not open')
      closes.push(await measure(() => key('Escape')))
    }
    return [...opens, ...closes]
  }),

  /** Arrow keys through the preview, one photo per frame or slower. */
  switch: () => timed(async () => {
    click(tilesOnScreen()[0].querySelector('.thumb'))
    await nextPaint()
    const out: number[] = []
    for (let i = 0; i < 60; i++)
      out.push(await measure(() => key(i % 4 === 3 ? 'ArrowLeft' : 'ArrowRight')))
    return out
  }),

  /** A held arrow key: presses faster than frames, the preview keeping up. */
  burst: () => timed(async () => {
    const stop = recordFrames()
    const start = performance.now()
    for (let i = 0; i < 80; i++) {
      key('ArrowRight')
      await wait(8)
    }
    await nextPaint()
    const settle = performance.now() - start
    const frames = stop()
    key('Escape')
    await nextPaint()
    return frames.length ? frames : [settle]
  }),

  /** Deleting photos from the preview: the list shrinks and the grid closes up. */
  delete: () => timed(async () => {
    click(tilesOnScreen()[0].querySelector('.thumb'))
    await nextPaint()
    const out: number[] = []
    for (let i = 0; i < 10; i++)
      out.push(await measure(() => key('Backspace')))
    key('Escape')
    await nextPaint()
    return out
  }),

  /** A folder scan streaming in: 100 photos a frame into a second tab. */
  stream: () => timed(async () => {
    click(document.querySelector('.tabbar button[data-tab="1"]'))
    await nextPaint()
    const out: number[] = []
    for (let i = 0; i < PHOTO_COUNT / 100; i++)
      out.push(await measure(() => tabs.get(1)!.append(makePhotos(100, i * 100, IMAGES, 2))))
    return out
  }),

  /** Switching between tabs that each keep their gallery mounted. */
  tabs: () => timed(async () => {
    tabs.get(2)!.load(makePhotos(PHOTO_COUNT, 0, IMAGES, 3))
    await nextPaint()
    const out: number[] = []
    for (let i = 0; i < 15; i++)
      out.push(await measure(() => click(document.querySelector(`.tabbar button[data-tab="${i % 3}"]`))))
    click(document.querySelector('.tabbar button[data-tab="0"]'))
    await nextPaint()
    return out
  }),

  /** Nothing for a minute: whether WebKit gives back decoded pictures by itself. */
  idle: () => timed(async () => {
    await wait(60_000)
    return [0]
  }),

  /** Preview open, a few switches, close; repeated to show retained memory. */
  churn: () => timed(async () => {
    const out: number[] = []
    for (let i = 0; i < 20; i++) {
      const start = performance.now()
      click(tilesOnScreen()[i % 5].querySelector('.thumb'))
      await nextPaint()
      for (let j = 0; j < 10; j++) {
        key('ArrowRight')
        await nextPaint()
      }
      key('Escape')
      await nextPaint()
      setWidth(i % 2 ? 240 : 200)
      out.push((await nextPaint()) - start)
    }
    return out
  }),
}

declare global {
  interface Window {
    bench: typeof bench
  }
}

const bench = {
  /** Called by each app once, after its first render is on screen. */
  mounted() {
    void nextPaint().then((t) => {
      mountedAt = t
    })
  },
  registerTab(index: number, api: TabApi) {
    tabs.set(index, api)
  },
  /** A tab's API, for probing by hand. */
  tab: (index: number) => tabs.get(index)!,
  get ready() {
    return mountedAt > 0 && tabs.size === TAB_COUNT && sourceReady
  },
  get bootMs() {
    return mountedAt
  },
  longTasks,
  /** The page's animation-frame rate, in Hz: 60 headless, up to 120 on a ProMotion display. */
  refreshRate: () => new Promise<number>((resolve) => {
    const times: number[] = []
    function tick(t: number) {
      times.push(t)
      if (times.length < 120)
        requestAnimationFrame(tick)
      else
        resolve(1000 / ((times.at(-1)! - times[10]) / (times.length - 11)))
    }
    requestAnimationFrame(tick)
  }),
  run: (name: string) => scenarios[name](),
  scenarios: Object.keys(scenarios),
}

window.bench = bench
