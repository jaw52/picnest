import type { PageDirection } from './swipe-pager'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import doubleSwipeRight from './__fixtures__/wheel/double-swipe-right.json'
import slowDragRight from './__fixtures__/wheel/slow-drag-right.json'
import swipeDownFast from './__fixtures__/wheel/swipe-down-fast-trackpad.json'
import swipeLeftFast from './__fixtures__/wheel/swipe-left-fast-trackpad.json'
import swipeLeft from './__fixtures__/wheel/swipe-left-trackpad.json'
import swipeRightFast from './__fixtures__/wheel/swipe-right-fast.json'
import swipeRight from './__fixtures__/wheel/swipe-right.json'
import swipeUp from './__fixtures__/wheel/swipe-up-trackpad.json'
import { createSwipePager } from './swipe-pager'

// The fixtures are real Mac trackpad recordings (Chrome and Safari), taken
// from wheel-gestures' own test suite (MIT, © 2020 Felix Leupold).

interface Recorded {
  deltaX: number
  deltaY: number
  timeStamp: number
}

/** Replays events at their recorded pace, since gestures end on a pause. */
function replay(events: Recorded[], canPage: (direction: PageDirection) => boolean = () => true) {
  const commits: PageDirection[] = []
  const follows: number[] = []
  let releases = 0
  const pager = createSwipePager({
    distance: () => 200,
    canPage,
    follow: offset => follows.push(offset),
    commit: direction => commits.push(direction),
    release: () => releases++,
  })
  let last = events[0].timeStamp
  for (const event of events) {
    vi.advanceTimersByTime(event.timeStamp - last)
    last = event.timeStamp
    pager.push(event)
  }
  vi.advanceTimersByTime(2000)
  return { commits, follows, releases }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createSwipePager', () => {
  it('turns to the next photo for a swipe left, once', () => {
    expect(replay(swipeLeft).commits).toEqual([1])
    expect(replay(swipeLeftFast).commits).toEqual([1])
  })

  it('turns to the previous photo for a swipe right, once', () => {
    expect(replay(swipeRight).commits).toEqual([-1])
    expect(replay(swipeRightFast).commits).toEqual([-1])
    expect(replay(slowDragRight).commits).toEqual([-1])
  })

  it('moves the photo with the fingers until the page turns', () => {
    const { follows } = replay(swipeRight)
    expect(follows.length).toBeGreaterThan(3)
    // Fingers moving right drag the photo right, a little further each event.
    expect(follows.every((x, i) => x > 0 && (i === 0 || x >= follows[i - 1]))).toBe(true)
    expect(follows.at(-1)).toBeLessThan(200)
  })

  it('turns again for a swipe that interrupts the previous momentum', () => {
    expect(replay(doubleSwipeRight).commits).toEqual([-1, -1])
  })

  it('turns again for a swipe after the previous one ended', () => {
    const shifted = swipeLeft.map(e => ({ ...e, timeStamp: e.timeStamp + 5000 }))
    expect(replay([...swipeLeft, ...shifted]).commits).toEqual([1, 1])
  })

  it('ignores vertical scrolls', () => {
    for (const events of [swipeUp, swipeDownFast]) {
      const { commits, follows, releases } = replay(events)
      expect([commits, follows, releases]).toEqual([[], [], 0])
    }
  })

  it('settles back from a short drag', () => {
    const short = swipeRight.slice(0, 6)
    const { commits, follows, releases } = replay(short)
    expect(commits).toEqual([])
    expect(follows.at(-1)).toBeGreaterThan(0)
    expect(releases).toBe(1)
  })

  it('only gives a little past the first photo, and settles back', () => {
    const { commits, follows, releases } = replay(swipeRight, direction => direction === 1)
    expect(commits).toEqual([])
    expect(Math.max(...follows)).toBeLessThan(1634 * 0.25 + 1)
    expect(releases).toBe(1)
  })
})
