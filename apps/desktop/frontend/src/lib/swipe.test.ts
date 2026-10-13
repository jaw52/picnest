import { describe, expect, it } from 'vitest'

import { createSwipeDetector, SWIPE_IDLE_MS } from './swipe'

/** A finger swipe that ramps up, then momentum that decays to nothing. */
function gesture(sign: 1 | -1, momentumUntil = 0) {
  const ramp = [2, 6, 14, 24, 30]
  const momentum = [28, 25, 22, 19, 16, 13, 10, 8, 6, 4, 3, 2, 1].filter(d => d >= momentumUntil)
  return [...ramp, ...momentum].map(d => d * sign)
}

/** Feeds deltas 16ms apart from `start`; returns the swipes and the end time. */
function feed(detector: ReturnType<typeof createSwipeDetector>, deltas: number[], start = 0) {
  const swipes: number[] = []
  let t = start
  for (const d of deltas) {
    const s = detector.push(d, 0, t)
    if (s !== 0)
      swipes.push(s)
    t += 16
  }
  return { swipes, end: t }
}

describe('createSwipeDetector', () => {
  it('fires once per gesture, momentum included', () => {
    expect(feed(createSwipeDetector(), gesture(1)).swipes).toEqual([1])
  })

  it('maps fingers moving right to the previous photo', () => {
    expect(feed(createSwipeDetector(), gesture(-1)).swipes).toEqual([-1])
  })

  it('fires again for a swipe that interrupts the previous momentum', () => {
    const deltas = [...gesture(1, 10), ...gesture(1, 8), ...gesture(1)]
    expect(feed(createSwipeDetector(), deltas).swipes).toEqual([1, 1, 1])
  })

  it('fires for a reversal during momentum', () => {
    const deltas = [...gesture(1, 10), ...gesture(-1)]
    expect(feed(createSwipeDetector(), deltas).swipes).toEqual([1, -1])
  })

  it('fires again after a pause', () => {
    const d = createSwipeDetector()
    const first = feed(d, gesture(1))
    expect(feed(d, gesture(1), first.end + SWIPE_IDLE_MS + 1).swipes).toEqual([1])
  })

  it('ignores jitter within momentum', () => {
    const deltas = [2, 6, 14, 24, 30, 28, 29, 25, 26, 22, 19, 16, 13, 10, 8, 6, 4, 2, 1]
    expect(feed(createSwipeDetector(), deltas).swipes).toEqual([1])
  })

  it('ignores mostly vertical scrolls', () => {
    const d = createSwipeDetector()
    for (let i = 0; i < 20; i++)
      expect(d.push(10, 30, i * 16)).toBe(0)
  })
})
