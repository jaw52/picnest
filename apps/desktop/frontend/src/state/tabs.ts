import type { TabsState } from '~/types/tabs'
import { computed } from 'vue'
import { pickFolder } from '~/lib/backend'
import { withFolderAdded } from '~/lib/folders'
import {
  activeTab,
  initialTabsState,
  withBack,
  withFolderClosed,
  withForward,
  withOtherTabsClosed,
  withPathOpened,
  withPathOpenedInBackground,
  withPathOpenedInNewTab,
  withTabActivated,
  withTabClosed,
  withTabCycled,
  withTabOpened,
  withTabsToRightClosed,
} from '~/lib/tabs'
import { persisted } from './persisted'
import { recentFolders } from './recentFolders'

/**
 * Persisted, so the open tabs come back on the next launch. Read on
 * creation: the active tab's folder is scanned on mount, and a late storage
 * read would scan the default tab first.
 */
export const tabsState = persisted<TabsState>('picnest.openTabs', initialTabsState())

export const activeTabId = computed(() => activeTab(tabsState.value).id)

/** The folder the active tab shows; null on the new-tab page. */
export const activeTabPath = computed(() => activeTab(tabsState.value).path)

export const canGoBack = computed(() => activeTab(tabsState.value).back.length > 0)
export const canGoForward = computed(() => activeTab(tabsState.value).forward.length > 0)

function update(next: (state: TabsState) => TabsState): void {
  tabsState.value = next(tabsState.value)
}

/** Shows `path` in the active tab, which can then go back to where it was. */
export function openInActiveTab(path: string): void {
  update(state => withPathOpened(state, path))
}

/** Opens `path` in a new tab without leaving this one (⌘-click). */
function openInBackground(path: string): void {
  update(state => withPathOpenedInBackground(state, path))
}

/**
 * Follows a click on a folder like a browser follows a link: ⌘ or the
 * middle button opens it in a background tab, a plain click in this one.
 */
export function openFromClick(path: string, e: { metaKey: boolean, button: number }): void {
  if (e.metaKey || e.button === 1)
    openInBackground(path)
  else
    openInActiveTab(path)
}

export function goBack(): void {
  update(withBack)
}

export function goForward(): void {
  update(withForward)
}

/** Opens `path` in its own tab; the new-tab page it was picked from stays open. */
export function openInNewTab(path: string): void {
  update(state => withPathOpenedInNewTab(state, path))
}

/** Lists `path` on the new-tab page, without opening it. */
export function addFolderByPath(path: string): void {
  recentFolders.value = withFolderAdded(recentFolders.value, path)
}

export async function addFolder(): Promise<void> {
  const folder = await pickFolder()
  if (folder)
    addFolderByPath(folder)
}

export function newTab(): void {
  update(state => withTabOpened(state))
}

export function closeTab(id: string): void {
  update(state => withTabClosed(state, id))
}

export function closeOtherTabs(id: string): void {
  update(state => withOtherTabsClosed(state, id))
}

export function closeTabsToRight(id: string): void {
  update(state => withTabsToRightClosed(state, id))
}

export function activateTab(id: string): void {
  update(state => withTabActivated(state, id))
}

export function closeActiveTab(): void {
  update(state => withTabClosed(state, state.activeId))
}

/** ⌘1-⌘8 pick a tab by position; ⌘9 always picks the last one, as in browsers. */
export function activateTabAt(position: number): void {
  update((state) => {
    const tab = position === 9 ? state.tabs.at(-1) : state.tabs[position - 1]
    return tab ? withTabActivated(state, tab.id) : state
  })
}

export function cycleTab(offset: number): void {
  update(state => withTabCycled(state, offset))
}

/** For a folder that's gone from disk: closes every tab inside it. */
export function closeFolderTabs(folder: string): void {
  update(state => withFolderClosed(state, folder))
}
