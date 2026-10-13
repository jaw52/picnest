import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import doubleSwipeRight from './__fixtures__/wheel/double-swipe-right.json'
import slowDragRight from './__fixtures__/wheel/slow-drag-right.json'
import swipeDownFast from './__fixtures__/wheel/swipe-down-fast-trackpad.json'
import swipeLeftFast from './__fixtures__/wheel/swipe-left-fast-trackpad.json'
import swipeLeft from './__fixtures__/wheel/swipe-left-trackpad.json'
import swipeRightFast from './__fixtures__/wheel/swipe-right-fast.json'
import swipeRight from './__fixtures__/wheel/swipe-right.json'
import swipeUp from './__fixtures__/wheel/swipe-up-trackpad.json'
import { createSwipeDetector } from './swipe'

// The fixtures are real Mac trackpad recordings (Chrome and Safari), taken
// from wheel-gestures' own test suite (MIT, © 2020 Felix Leupold).

interface Recorded {
  deltaMode: number
  deltaX: number
  deltaY: number
  timeStamp: number
}

/** Replays events at their recorded pace, since gestures end on a timeout. */
function replay(events: Recorded[]) {
  const detector = createSwipeDetector()
  const swipes: number[] = []
  let last = events[0].timeStamp
  for (const event of events) {
    vi.advanceTimersByTime(event.timeStamp - last)
    last = event.timeStamp
    const swipe = detector.push(event)
    if (swipe !== 0)
      swipes.push(swipe)
  }
  vi.advanceTimersByTime(2000)
  return swipes
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createSwipeDetector', () => {
  it('maps a swipe left to the next photo, once', () => {
    expect(replay(swipeLeft)).toEqual([1])
    expect(replay(swipeLeftFast)).toEqual([1])
  })

  it('maps a swipe right to the previous photo, once', () => {
    expect(replay(swipeRight)).toEqual([-1])
    expect(replay(swipeRightFast)).toEqual([-1])
  })

  it('fires once for a slow drag', () => {
    expect(replay(slowDragRight)).toEqual([-1])
  })

  it('fires again for a swipe that interrupts the previous momentum', () => {
    expect(replay(doubleSwipeRight)).toEqual([-1, -1])
  })

  it('fires again for a swipe after the previous one ended', () => {
    const shifted = swipeLeft.map(e => ({ ...e, timeStamp: e.timeStamp + 5000 }))
    expect(replay([...swipeLeft, ...shifted])).toEqual([1, 1])
  })

  it('ignores vertical scrolls', () => {
    expect(replay(swipeUp)).toEqual([])
    expect(replay(swipeDownFast)).toEqual([])
  })
})
