import type { TabsState } from './tabs'
import { describe, expect, it } from 'vitest'
import {
  activeTab,
  withBack,
  withFolderClosed,
  withForward,
  withOtherTabsClosed,
  withPathOpened,
  withPathOpenedInBackground,
  withPathOpenedInNewTab,
  withTabClosed,
  withTabCycled,
  withTabOpened,
  withTabsToRightClosed,
} from './tabs'

function state(paths: (string | null)[], activeIndex = 0): TabsState {
  const tabs = paths.map((path, i) => ({ id: `t${i}`, path, back: [], forward: [] }))
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

  it('closes the other tabs, focusing the one kept', () => {
    const next = withOtherTabsClosed(state(['/a', '/b', '/c'], 0), 't1')
    expect(paths(next)).toEqual(['/b'])
    expect(next.activeId).toBe('t1')
  })

  it('closes the tabs to the right, focusing the clicked one only if the active one went', () => {
    expect(paths(withTabsToRightClosed(state(['/a', '/b', '/c'], 0), 't1'))).toEqual(['/a', '/b'])
    expect(withTabsToRightClosed(state(['/a', '/b', '/c'], 0), 't1').activeId).toBe('t0')
    expect(withTabsToRightClosed(state(['/a', '/b', '/c'], 2), 't0').activeId).toBe('t0')
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

  it('goes back and forward through the folders a tab showed', () => {
    const visited = withPathOpened(withPathOpened(state(['/a']), '/a/b'), '/a/b/c')
    const back = withBack(withBack(visited))
    expect(activeTab(back).path).toBe('/a')
    expect(withBack(back)).toBe(back)
    const forward = withForward(back)
    expect(activeTab(forward).path).toBe('/a/b')
    expect(activeTab(withForward(forward)).path).toBe('/a/b/c')
  })

  it('forgets the folders gone back from once another one opens', () => {
    const back = withBack(withPathOpened(state(['/a']), '/a/b'))
    const next = withPathOpened(back, '/a/c')
    expect(withForward(next)).toBe(next)
    expect(activeTab(withBack(next)).path).toBe('/a')
  })

  it('opens ⌘-clicked folders behind the active tab, in the order they were clicked', () => {
    const next = withPathOpenedInBackground(
      withPathOpenedInBackground(state(['/a', '/z']), '/a/1'),
      '/a/2',
    )
    expect(paths(next)).toEqual(['/a', '/a/1', '/a/2', '/z'])
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

  it('drops a removed folder from the history, never leaving a step back to where the tab is', () => {
    const visited = withPathOpened(withPathOpened(state(['/a']), '/a/gone'), '/a')
    const next = withFolderClosed(visited, '/a/gone')
    expect(activeTab(next).back).toEqual([])
  })
})
