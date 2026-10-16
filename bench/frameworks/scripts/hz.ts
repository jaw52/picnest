// Prints the animation-frame rate each browser reaches, headless and with a
// window on screen: a ProMotion display runs at 120Hz only in the latter.

import { chromium, webkit } from 'playwright'

for (const headless of [true, false]) {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]] as const) {
    const browser = await type.launch({ headless, channel: name === 'chromium' ? 'chromium' : undefined })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.setContent('<div style="width:100px;height:100px;background:red"></div>')
    await page.bringToFront()
    await page.waitForTimeout(500)
    const hz = await page.evaluate(() => new Promise<number>((resolve) => {
      const times: number[] = []
      function tick(t: number) {
        times.push(t)
        if (times.length < 240)
          requestAnimationFrame(tick)
        else
          resolve(1000 / ((times.at(-1)! - times[20]) / (times.length - 21)))
      }
      requestAnimationFrame(tick)
    }))
    console.log(`${name.padEnd(8)} ${headless ? 'headless' : 'headed  '} ${hz.toFixed(1)} Hz`)
    await browser.close()
  }
}
