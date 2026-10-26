import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { PULL_MAX, useBottomPull } from './useBottomPull'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function wheel(deltaY: number) {
  act(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY }))
  })
}

// jsdom's page has no height, so it is always scrolled to its bottom.
it('pulls past the end against growing resistance, up to PULL_MAX', () => {
  const { result } = renderHook(() => useBottomPull(true, document.documentElement))
  wheel(40)
  const first = result.current.get()
  expect(first).toBeGreaterThan(0)
  expect(first).toBeLessThan(40)
  for (let i = 0; i < 50; i++) wheel(100)
  expect(result.current.get()).toBeGreaterThan(PULL_MAX * 0.99)
  expect(result.current.get()).toBeLessThanOrEqual(PULL_MAX)
})

it('springs back once the wheel goes quiet', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const { result } = renderHook(() => useBottomPull(true, document.documentElement))
  wheel(60)
  expect(result.current.get()).toBeGreaterThan(0)
  act(() => {
    vi.advanceTimersByTime(200)
  })
  vi.useRealTimers()
  await vi.waitFor(() => expect(result.current.get()).toBeCloseTo(0, 0))
})

it('leaves pinch zoom and a disabled grid alone', () => {
  const { result, rerender } = renderHook(({ enabled }) => useBottomPull(enabled, document.documentElement), {
    initialProps: { enabled: true },
  })
  act(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, ctrlKey: true }))
  })
  expect(result.current.get()).toBe(0)
  rerender({ enabled: false })
  wheel(50)
  expect(result.current.get()).toBe(0)
})

it('shows nothing for the scroll that reaches the end, only for another try after it', () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const height = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(5000)
  const { result } = renderHook(() => useBottomPull(true, document.documentElement))
  // Scrolling down to the end, then on with the same scroll's momentum.
  wheel(80)
  height.mockReturnValue(0)
  for (let i = 0; i < 20; i++) {
    now += 16
    wheel(40)
  }
  expect(result.current.get()).toBe(0)
  // A pause, then scrolling again.
  now += 400
  wheel(40)
  expect(result.current.get()).toBeGreaterThan(0)
})
