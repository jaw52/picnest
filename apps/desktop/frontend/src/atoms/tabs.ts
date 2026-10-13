import type { TabsState } from '~/lib/tabs'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { activeTab, initialTabsState } from '~/lib/tabs'

/**
 * Persisted, so the open tabs come back on the next launch. Read on init:
 * the active tab's folder is scanned on mount, and a late storage read would
 * scan the default tab first.
 */
export const tabsStateAtom = atomWithStorage<TabsState>(
  'picnest.openTabs',
  initialTabsState(),
  undefined,
  { getOnInit: true },
)

/** The folder the active tab shows; null on the new-tab page. */
export const activeTabPathAtom = atom(get => activeTab(get(tabsStateAtom)).path)

export const canGoBackAtom = atom(get => activeTab(get(tabsStateAtom)).back.length > 0)
export const canGoForwardAtom = atom(get => activeTab(get(tabsStateAtom)).forward.length > 0)
