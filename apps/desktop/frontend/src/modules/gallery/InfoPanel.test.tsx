import { act, fireEvent, render, screen } from '@testing-library/react'
import { motionValue } from 'framer-motion'
import { createStore, Provider } from 'jotai'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  INFO_SIDEBAR_DEFAULT_WIDTH,
  INFO_SIDEBAR_MAX_WIDTH,
  INFO_SIDEBAR_MIN_WIDTH,
  infoSidebarCollapsedAtom,
  infoSidebarWidthAtom,
} from '~/atoms/layout'
import { InfoPanel } from './InfoPanel'

vi.mock('./InfoSidebar', () => ({ InfoSidebar: () => <div>info</div> }))

// The layout atoms persist to localStorage, which would leak between tests.
beforeEach(() => {
  localStorage.clear()
  // Wide enough that the side panels' own limits apply, not the grid's minimum.
  window.innerWidth = 1600
})

function setup() {
  const store = createStore()
  const extent = motionValue(INFO_SIDEBAR_DEFAULT_WIDTH)
  render(
    <Provider store={store}>
      <InfoPanel extent={extent} top={0} paddingTop={0} />
    </Provider>,
  )
  return { store, extent, handle: screen.getByRole('separator') }
}

it('resizes with the arrow keys, within bounds, driving the extent directly', () => {
  const { store, extent, handle } = setup()

  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_DEFAULT_WIDTH + 16)
  expect(extent.get()).toBe(INFO_SIDEBAR_DEFAULT_WIDTH + 16)

  for (let i = 0; i < 100; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_MAX_WIDTH)

  for (let i = 0; i < 100; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_MIN_WIDTH)
})

it('resets to the default width on double click', () => {
  const { store, handle } = setup()
  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  fireEvent.doubleClick(handle)
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_DEFAULT_WIDTH)
})

it('makes the content inert and unfocusable when collapsed', () => {
  const { store, handle } = setup()
  expect(handle.tabIndex).toBe(0)
  act(() => store.set(infoSidebarCollapsedAtom, true))
  expect(screen.getByText('info').parentElement?.hasAttribute('inert')).toBe(true)
  expect(handle.tabIndex).toBe(-1)
})

function dragFrom(handle: HTMLElement, fromX: number, toX: number) {
  fireEvent.pointerDown(handle, { clientX: fromX, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientX: toX, pointerId: 1 })
}

it('collapses on release after being dragged past the threshold', () => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  const { store, handle } = setup()
  // Panel is 260 wide and grows leftward: dragging right by 120 makes it 140.
  dragFrom(handle, 800, 920)
  expect(store.get(infoSidebarCollapsedAtom)).toBe(false)
  fireEvent.pointerUp(handle, { pointerId: 1 })
  expect(store.get(infoSidebarCollapsedAtom)).toBe(true)
  // The width to come back to is the last real one, not the dragged-to 140.
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_DEFAULT_WIDTH)
})

it('stays open when dragged past the threshold and back before release', () => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  const { store, handle } = setup()
  dragFrom(handle, 800, 920)
  fireEvent.pointerMove(handle, { clientX: 790, pointerId: 1 })
  fireEvent.pointerUp(handle, { pointerId: 1 })
  expect(store.get(infoSidebarCollapsedAtom)).toBe(false)
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_DEFAULT_WIDTH + 10)
})

it('only clamps, without collapsing, between the threshold and the minimum', () => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  const { store, handle } = setup()
  dragFrom(handle, 800, 860) // 200px: under the 220 minimum, over the 160 threshold
  fireEvent.pointerUp(handle, { pointerId: 1 })
  expect(store.get(infoSidebarCollapsedAtom)).toBe(false)
  expect(store.get(infoSidebarWidthAtom)).toBe(INFO_SIDEBAR_MIN_WIDTH)
})

it('holds back the panel so the grid keeps its minimum width on a narrow window', () => {
  window.innerWidth = 700
  const { store, handle } = setup()
  for (let i = 0; i < 100; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  // 700 - 360 (grid minimum)
  expect(store.get(infoSidebarWidthAtom)).toBe(340)
})
