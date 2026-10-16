// Checks every app behaves the same: drives each through one sequence and
// compares what the DOM shows after each step. Run after changing an app.

import { chromium } from 'playwright'
import { FRAMEWORKS } from './frameworks.ts'
import { serve } from './serve.ts'

const { url, close } = await serve()
const browser = await chromium.launch({ channel: 'chromium' })
const seen: Record<string, unknown> = {}

for (const fw of FRAMEWORKS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', error => console.error(`  ! ${fw}: ${error.message}`))
  await page.goto(`${url}/${fw}/?n=500&img=0`)
  await page.waitForFunction(() => window.bench?.ready)
  await page.evaluate(() => window.bench.run('load'))
  const steps = await page.evaluate(async () => {
    const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r)))
    const $ = (s: string) => document.querySelector<HTMLElement>(s)
    const $$ = (s: string) => document.querySelectorAll<HTMLElement>(s)
    const g = '.gallery[data-tab="0"]'
    const key = (key: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }))
    const click = (el: Element | null, init: MouseEventInit = {}) => el!.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }))
    const out: Record<string, unknown> = {}

    await frame()
    out.loaded = [$(`${g} .count`)!.textContent, $$(`${g} .tile`).length > 20]
    const first = $(`${g} .tile`)!
    const firstBox = first.getBoundingClientRect()
    out.firstTile = [first.dataset.photoId, Math.round(firstBox.width), Math.round(firstBox.height)]

    click($(`${g} button[data-filter="4"]`))
    await frame()
    out.filter4 = [$(`${g} .count`)!.textContent, $(`${g} .tile`)!.dataset.photoId]
    click($(`${g} button[data-filter="all"]`))
    await frame()

    const id = first.dataset.photoId!
    click($(`${g} .tile[data-photo-id="${id}"] button[data-star="3"]`))
    await frame()
    out.rated = $$(`${g} .tile[data-photo-id="${id}"] .stars button.on`).length
    out.previewNotOpenedByStar = $('.preview') === null

    key('a', { metaKey: true })
    await frame()
    out.selectAll = $$(`${g} .tile.selected`).length === $$(`${g} .tile`).length
    key('Escape')
    await frame()
    out.cleared = $$(`${g} .tile.selected`).length
    click($(`${g} .tile[data-photo-id="${id}"]`), { metaKey: true })
    await frame()
    out.toggled = [...$$(`${g} .tile.selected`)].map(t => t.dataset.photoId)
    key('Escape')
    await frame()

    const input = $(`${g} input.width`) as HTMLInputElement
    input.value = '320'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await frame()
    out.resized = Math.round($(`${g} .tile`)!.getBoundingClientRect().width)

    click($(`${g} .tile[data-photo-id="${id}"] .thumb`))
    await frame()
    out.opened = [$('.preview .count')?.textContent, $$('.preview .page').length]
    for (let i = 0; i < 3; i++) {
      key('ArrowRight')
      await frame()
    }
    await frame()
    out.switched = [$('.preview .count')?.textContent, $('.preview .name')?.textContent, $$('.film-thumb.current').length, $$('.preview .page').length]
    key('Backspace')
    await frame()
    out.deleted = [$('.preview .count')?.textContent, $('.preview .name')?.textContent]
    key('5')
    key('Escape')
    await frame()
    out.closed = [$('.preview') === null, $(`${g} .count`)!.textContent]

    click($('.tabbar button[data-tab="1"]'))
    await frame()
    out.tab = [$(g)!.offsetParent === null, $('.gallery[data-tab="1"]')!.offsetParent !== null]
    return out
  })
  seen[fw] = steps
  await page.close()
}
await browser.close()
close()

const [reference, ...others] = FRAMEWORKS
let ok = true
for (const fw of others) {
  for (const [step, value] of Object.entries(seen[reference] as object)) {
    const theirs = (seen[fw] as Record<string, unknown>)[step]
    if (JSON.stringify(theirs) !== JSON.stringify(value)) {
      ok = false
      console.log(`✗ ${fw} ${step}: ${JSON.stringify(theirs)} ≠ ${reference} ${JSON.stringify(value)}`)
    }
  }
}
console.log(JSON.stringify(seen[reference], null, 1))
console.log(ok ? '✓ all apps behave the same' : '✗ apps differ')
process.exit(ok ? 0 : 1)
