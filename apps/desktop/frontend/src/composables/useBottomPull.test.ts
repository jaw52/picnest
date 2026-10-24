import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, shallowRef } from 'vue'
import { PULL_MAX, useBottomPull } from './useBottomPull'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function wheel(deltaY: number) {
  window.dispatchEvent(new WheelEvent('wheel', { deltaY }))
}

function mountPull(enabled = shallowRef(true)) {
  let pull!: ReturnType<typeof useBottomPull>
  mount(defineComponent({
    setup() {
      pull = useBottomPull(enabled, document.documentElement)
      return () => null
    },
  }))
  return pull
}

// The test page has no height, so it is always scrolled to its bottom.
it('pulls past the end against growing resistance, up to PULL_MAX', () => {
  const pull = mountPull()
  wheel(40)
  const first = pull.get()
  expect(first).toBeGreaterThan(0)
  expect(first).toBeLessThan(40)
  for (let i = 0; i < 50; i++)
    wheel(100)
  expect(pull.get()).toBeGreaterThan(PULL_MAX * 0.99)
  expect(pull.get()).toBeLessThanOrEqual(PULL_MAX)
})

it('springs back once the wheel goes quiet', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const pull = mountPull()
  wheel(60)
  expect(pull.get()).toBeGreaterThan(0)
  vi.advanceTimersByTime(200)
  vi.useRealTimers()
  await vi.waitFor(() => expect(pull.get()).toBeCloseTo(0, 0))
})

it('leaves pinch zoom and a disabled grid alone', async () => {
  const enabled = shallowRef(true)
  const pull = mountPull(enabled)
  // happy-dom's WheelEvent leaves out the modifier keys.
  const pinch = new WheelEvent('wheel', { deltaY: 50 })
  Object.defineProperty(pinch, 'ctrlKey', { value: true })
  window.dispatchEvent(pinch)
  expect(pull.get()).toBe(0)
  enabled.value = false
  await nextTick()
  wheel(50)
  expect(pull.get()).toBe(0)
})

it('shows nothing for the scroll that reaches the end, only for another try after it', () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const height = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(5000)
  const pull = mountPull()
  // Scrolling down to the end, then on with the same scroll's momentum.
  wheel(80)
  height.mockReturnValue(0)
  for (let i = 0; i < 20; i++) {
    now += 16
    wheel(40)
  }
  expect(pull.get()).toBe(0)
  // A pause, then scrolling again.
  now += 400
  wheel(40)
  expect(pull.get()).toBeGreaterThan(0)
})
