import type { TabsState } from './tabs'
import { describe, expect, it } from 'vitest'
import {
  activeTab,
  withFolderClosed,
  withPathOpened,
  withPathOpenedInNewTab,
  withTabClosed,
  withTabCycled,
  withTabOpened,
} from './tabs'

function state(paths: (string | null)[], activeIndex = 0): TabsState {
  const tabs = paths.map((path, i) => ({ id: `t${i}`, path }))
  return { tabs, activeId: tabs[activeIndex].id }
}

const paths = (s: TabsState) => s.tabs.map(t => t.path)

describe('tabs', () => {
  it('opens a new tab right after the active one and focuses it', () => {
    const next = withTabOpened(state(['/a', '/b'], 0))
    expect(paths(next)).toEqual(['/a', null, '/b'])
    expect(activeTab(next).path).toBeNull()
  })

  it('closing the active tab focuses its right neighbour, or the left one at the end', () => {
    expect(withTabClosed(state(['/a', '/b', '/c'], 1), 't1').activeId).toBe('t2')
    expect(withTabClosed(state(['/a', '/b', '/c'], 2), 't2').activeId).toBe('t1')
  })

  it('closing an inactive tab keeps the focus where it is', () => {
    expect(withTabClosed(state(['/a', '/b'], 1), 't0').activeId).toBe('t1')
  })

  it('closing the last tab leaves a new-tab page', () => {
    const next = withTabClosed(state(['/a']), 't0')
    expect(paths(next)).toEqual([null])
    expect(activeTab(next).path).toBeNull()
  })

  it('cycles through tabs, wrapping around both ends', () => {
    expect(withTabCycled(state(['/a', '/b', '/c'], 2), 1).activeId).toBe('t0')
    expect(withTabCycled(state(['/a', '/b', '/c'], 0), -1).activeId).toBe('t2')
  })

  it('opens a folder in the active tab', () => {
    const next = withPathOpened(state(['/a', '/b'], 1), '/b/sub')
    expect(paths(next)).toEqual(['/a', '/b/sub'])
    expect(next.activeId).toBe('t1')
  })

  it('focuses the tab already showing a folder instead of opening it twice', () => {
    const next = withPathOpened(state(['/a', '/b'], 1), '/a')
    expect(paths(next)).toEqual(['/a', '/b'])
    expect(next.activeId).toBe('t0')
  })

  it('opens a folder in a new tab after the active one', () => {
    const next = withPathOpenedInNewTab(state(['/a', '/c']), '/b')
    expect(paths(next)).toEqual(['/a', '/b', '/c'])
    expect(activeTab(next).path).toBe('/b')
  })

  it('keeps the new-tab page open, putting the folder just before it', () => {
    const next = withPathOpenedInNewTab(state(['/a', null], 1), '/b')
    expect(paths(next)).toEqual(['/a', '/b', null])
    expect(activeTab(next).path).toBe('/b')
  })

  it('focuses the tab already showing a folder, leaving the new-tab page alone', () => {
    const next = withPathOpenedInNewTab(state(['/a', null], 1), '/a')
    expect(paths(next)).toEqual(['/a', null])
    expect(next.activeId).toBe('t0')
  })

  it('closes the tabs inside a removed folder', () => {
    const next = withFolderClosed(state(['/a', '/a/sub', '/ab'], 0), '/a')
    expect(paths(next)).toEqual(['/ab'])
    expect(activeTab(next).path).toBe('/ab')
  })
})
