import { isDescendantPath } from '~/atoms/recentFolders'

/** A browser-style tab. `path: null` is the new-tab page (add / pick a folder). */
export interface Tab {
  id: string
  path: string | null
  /** Folders this tab showed before, most recent last. */
  back: string[]
  /** Folders gone back from, most recent last; cleared by opening a new one. */
  forward: string[]
  /** The tab this one was ⌘-clicked open from, which keeps a run of them in order. */
  openerId?: string
}

export interface TabsState {
  tabs: Tab[]
  activeId: string
}

export function createTab(path: string | null = null, openerId?: string): Tab {
  return { id: crypto.randomUUID(), path, back: [], forward: [], openerId }
}

export function initialTabsState(): TabsState {
  const tab = createTab()
  return { tabs: [tab], activeId: tab.id }
}

export function activeTab(state: TabsState): Tab {
  return state.tabs.find(t => t.id === state.activeId) ?? state.tabs[0]
}

/**
 * Opens a new tab right after the active one and switches to it. A new-tab
 * page that is already open is switched to instead of opening another.
 */
export function withTabOpened(state: TabsState, path: string | null = null): TabsState {
  const blank = path === null ? state.tabs.find(t => t.path === null) : undefined
  if (blank)
    return withTabActivated(state, blank.id)
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

/** Closes every tab but `id`, which becomes the active one. */
export function withOtherTabsClosed(state: TabsState, id: string): TabsState {
  const tab = state.tabs.find(t => t.id === id)
  return tab ? { tabs: [tab], activeId: id } : state
}

/** Closes the tabs after `id`; if the active one goes with them, `id` takes over. */
export function withTabsToRightClosed(state: TabsState, id: string): TabsState {
  const index = state.tabs.findIndex(t => t.id === id)
  if (index === -1)
    return state
  const tabs = state.tabs.slice(0, index + 1)
  return { tabs, activeId: tabs.some(t => t.id === state.activeId) ? state.activeId : id }
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

function withActiveTab(state: TabsState, update: (tab: Tab) => Tab): TabsState {
  const current = activeTab(state)
  return { ...state, tabs: state.tabs.map(t => (t.id === current.id ? update(t) : t)) }
}

/** Shows `path` in the active tab, as a browser follows a link: the folder it left is one step back. */
export function withPathOpened(state: TabsState, path: string): TabsState {
  if (activeTab(state).path === path)
    return state
  return withActiveTab(state, tab => ({
    ...tab,
    path,
    back: tab.path === null ? tab.back : [...tab.back, tab.path],
    forward: [],
  }))
}

/** Steps the active tab back through the folders it showed; a no-op at the start. */
export function withBack(state: TabsState): TabsState {
  const tab = activeTab(state)
  const previous = tab.back.at(-1)
  if (previous === undefined || tab.path === null)
    return state
  return withActiveTab(state, t => ({
    ...t,
    path: previous,
    back: t.back.slice(0, -1),
    forward: [...t.forward, tab.path as string],
  }))
}

/** Undoes a `withBack`; a no-op unless the active tab went back. */
export function withForward(state: TabsState): TabsState {
  const tab = activeTab(state)
  const next = tab.forward.at(-1)
  if (next === undefined || tab.path === null)
    return state
  return withActiveTab(state, t => ({
    ...t,
    path: next,
    back: [...t.back, tab.path as string],
    forward: t.forward.slice(0, -1),
  }))
}

/**
 * Opens `path` in a new tab behind the active one, as ⌘-click does in a
 * browser. Successive ones line up after the active tab in the order they
 * were opened.
 */
export function withPathOpenedInBackground(state: TabsState, path: string): TabsState {
  let at = state.tabs.findIndex(t => t.id === state.activeId) + 1
  while (at < state.tabs.length && state.tabs[at].openerId === state.activeId)
    at++
  const tabs = [...state.tabs]
  tabs.splice(at, 0, createTab(path, state.activeId))
  return { ...state, tabs }
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
 * Closes every tab showing `folder` (or anything inside it) and drops it from
 * the other tabs' history - for when that folder is gone from disk or can't
 * be read.
 */
export function withFolderClosed(state: TabsState, folder: string): TabsState {
  const isGone = (path: string | null) =>
    path !== null && (path === folder || isDescendantPath(path, folder))
  // Dropping a folder can leave the same one twice in a row (or next to
  // the tab's own), which would make a step back go nowhere.
  const prune = (paths: string[], current: string | null) =>
    paths
      .filter(path => !isGone(path))
      .filter((path, i, kept) => path !== (i === kept.length - 1 ? current : kept[i + 1]))
  const pruned = {
    ...state,
    tabs: state.tabs.map(t => ({
      ...t,
      back: prune(t.back, t.path),
      forward: prune(t.forward, t.path),
    })),
  }
  return pruned.tabs
    .filter(t => isGone(t.path))
    .reduce((next, tab) => withTabClosed(next, tab.id), pruned)
}
