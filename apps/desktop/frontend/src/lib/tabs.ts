import { isDescendantPath } from '~/atoms/recentFolders'

/** A browser-style tab. `path: null` is the new-tab page (add / pick a folder). */
export interface Tab {
  id: string
  path: string | null
}

export interface TabsState {
  tabs: Tab[]
  activeId: string
}

export function createTab(path: string | null = null): Tab {
  return { id: crypto.randomUUID(), path }
}

export function initialTabsState(): TabsState {
  const tab = createTab()
  return { tabs: [tab], activeId: tab.id }
}

export function activeTab(state: TabsState): Tab {
  return state.tabs.find(t => t.id === state.activeId) ?? state.tabs[0]
}

/** Opens a new tab right after the active one and switches to it. */
export function withTabOpened(state: TabsState, path: string | null = null): TabsState {
  const tab = createTab(path)
  const index = state.tabs.findIndex(t => t.id === state.activeId)
  const tabs = [...state.tabs]
  tabs.splice(index + 1, 0, tab)
  return { tabs, activeId: tab.id }
}

/**
 * Closes a tab. Closing the active one activates its right neighbour (or the
 * left one at the end), like a browser; closing the last tab leaves a fresh
 * new-tab page rather than an empty window.
 */
export function withTabClosed(state: TabsState, id: string): TabsState {
  const index = state.tabs.findIndex(t => t.id === id)
  if (index === -1)
    return state
  const tabs = state.tabs.filter(t => t.id !== id)
  if (tabs.length === 0)
    return initialTabsState()
  if (state.activeId !== id)
    return { ...state, tabs }
  return { tabs, activeId: tabs[Math.min(index, tabs.length - 1)].id }
}

export function withTabActivated(state: TabsState, id: string): TabsState {
  if (state.activeId === id || !state.tabs.some(t => t.id === id))
    return state
  return { ...state, activeId: id }
}

/** Activates the tab `offset` places away from the active one, wrapping around. */
export function withTabCycled(state: TabsState, offset: number): TabsState {
  const index = state.tabs.findIndex(t => t.id === state.activeId)
  const count = state.tabs.length
  return { ...state, activeId: state.tabs[(((index + offset) % count) + count) % count].id }
}

/**
 * Shows `path` in the active tab (moving up or down folders). If another tab
 * already shows it, that tab is focused instead, so one folder never ends up
 * open twice.
 */
export function withPathOpened(state: TabsState, path: string): TabsState {
  const current = activeTab(state)
  if (current.path === path)
    return state
  const existing = state.tabs.find(t => t.path === path)
  if (existing)
    return { ...state, activeId: existing.id }
  return {
    ...state,
    tabs: state.tabs.map(t => (t.id === current.id ? { ...t, path } : t)),
  }
}

/**
 * Opens `path` in a new tab, or focuses the tab that already shows it. From
 * the new-tab page the folder opens just before it, so the page stays put
 * after the opened folders, ready for the next one.
 */
export function withPathOpenedInNewTab(state: TabsState, path: string): TabsState {
  const existing = state.tabs.find(t => t.path === path)
  if (existing)
    return withTabActivated(state, existing.id)
  const tab = createTab(path)
  const index = state.tabs.findIndex(t => t.id === state.activeId)
  const at = activeTab(state).path === null ? index : index + 1
  const tabs = [...state.tabs]
  tabs.splice(at, 0, tab)
  return { tabs, activeId: tab.id }
}

/**
 * Closes every tab showing `folder` (or anything inside it) - for when that
 * folder is gone from disk or can't be read.
 */
export function withFolderClosed(state: TabsState, folder: string): TabsState {
  return state.tabs
    .filter(t => t.path !== null && (t.path === folder || isDescendantPath(t.path, folder)))
    .reduce((next, tab) => withTabClosed(next, tab.id), state)
}
