import type { Box } from './zoom'
import { expect, it } from 'vitest'
import { actualSizeScale, clampView, FIT, zoomAbout } from './zoom'

// A 400x300 photo in an 800x600 viewport.
const box: Box = { imageW: 400, imageH: 300, viewW: 800, viewH: 600 }

it('keeps the point under the cursor fixed while zooming', () => {
  // Cursor 100px right of and 50px below the photo's center, zooming 1 -> 3.
  const view = zoomAbout(FIT, 3, 100, 50, box, 8)
  // The photo is now 1200x900, bigger than the viewport, so it may pan.
  expect(view.scale).toBe(3)
  const local = { x: 100 / 1, y: 50 / 1 } // image point under the cursor before
  expect(view.x + 3 * local.x).toBeCloseTo(100)
  expect(view.y + 3 * local.y).toBeCloseTo(50)
})

it('stays centered while the photo is smaller than the viewport', () => {
  const view = zoomAbout(FIT, 1.5, 150, 100, box, 8) // 600x450 still fits in 800x600
  expect(view).toEqual({ scale: 1.5, x: 0, y: 0 })
})

it('never zooms out past fit or in past the maximum', () => {
  expect(zoomAbout(FIT, 0.2, 0, 0, box, 8).scale).toBe(1)
  expect(zoomAbout(FIT, 100, 0, 0, box, 8).scale).toBe(8)
})

it('stops panning at the photo\'s edges', () => {
  // 3x is 1200 wide in an 800 viewport: 200px of slack each way.
  expect(clampView({ scale: 3, x: 999, y: 0 }, box).x).toBe(200)
  expect(clampView({ scale: 3, x: -999, y: 0 }, box).x).toBe(-200)
  expect(clampView({ scale: 3, x: 0, y: 999 }, box).y).toBe(150) // 900 high in 600
})

it('picks the actual-size scale, or 2 for a photo already shown at that size', () => {
  expect(actualSizeScale(3000, 1000)).toBe(3)
  expect(actualSizeScale(400, 400)).toBe(2)
})

it('clamps against where the photo actually rests when it is off-center', () => {
  // The photo rests 24px above the viewport's center (a caption strip below it).
  const off: Box = { ...box, offsetY: -24 }
  // 3x is 900 high in a 600 viewport: 150px of slack, shifted by the offset.
  expect(clampView({ scale: 3, x: 0, y: 999 }, off).y).toBe(150 + 24)
  expect(clampView({ scale: 3, x: 0, y: -999 }, off).y).toBe(-150 + 24)
})
