import { useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { recentFoldersAtom, withFolderAdded } from '~/atoms/recentFolders'
import { tabsStateAtom } from '~/atoms/tabs'
import { pickFolder } from '~/lib/backend'
import {
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

export function useTabs() {
  const setTabs = useSetAtom(tabsStateAtom)
  const setRecentFolders = useSetAtom(recentFoldersAtom)

  /** Shows `path` in the active tab, which can then go back to where it was. */
  const openInActiveTab = useCallback((path: string) => setTabs((state) => withPathOpened(state, path)), [setTabs])

  /** Opens `path` in a new tab without leaving this one (⌘-click). */
  const openInBackground = useCallback(
    (path: string) => setTabs((state) => withPathOpenedInBackground(state, path)),
    [setTabs],
  )

  /**
   * Follows a click on a folder like a browser follows a link: ⌘ or the
   * middle button opens it in a background tab, a plain click in this one.
   */
  const openFromClick = useCallback(
    (path: string, e: { metaKey: boolean; button: number }) => {
      if (e.metaKey || e.button === 1) openInBackground(path)
      else openInActiveTab(path)
    },
    [openInActiveTab, openInBackground],
  )

  const goBack = useCallback(() => setTabs(withBack), [setTabs])
  const goForward = useCallback(() => setTabs(withForward), [setTabs])

  /** Opens `path` in its own tab; the new-tab page it was picked from stays open. */
  const openInNewTab = useCallback((path: string) => setTabs((state) => withPathOpenedInNewTab(state, path)), [setTabs])

  /** Lists `path` on the new-tab page, without opening it. */
  const addFolderByPath = useCallback(
    (path: string) => setRecentFolders((prev) => withFolderAdded(prev, path)),
    [setRecentFolders],
  )

  const addFolder = useCallback(async () => {
    const folder = await pickFolder()
    if (folder) addFolderByPath(folder)
  }, [addFolderByPath])

  const newTab = useCallback(() => setTabs((state) => withTabOpened(state)), [setTabs])
  const closeTab = useCallback((id: string) => setTabs((state) => withTabClosed(state, id)), [setTabs])
  const closeOtherTabs = useCallback((id: string) => setTabs((state) => withOtherTabsClosed(state, id)), [setTabs])
  const closeTabsToRight = useCallback((id: string) => setTabs((state) => withTabsToRightClosed(state, id)), [setTabs])
  const activateTab = useCallback((id: string) => setTabs((state) => withTabActivated(state, id)), [setTabs])
  const closeActiveTab = useCallback(() => setTabs((state) => withTabClosed(state, state.activeId)), [setTabs])
  /** ⌘1-⌘8 pick a tab by position; ⌘9 always picks the last one, as in browsers. */
  const activateTabAt = useCallback(
    (position: number) =>
      setTabs((state) => {
        const tab = position === 9 ? state.tabs.at(-1) : state.tabs[position - 1]
        return tab ? withTabActivated(state, tab.id) : state
      }),
    [setTabs],
  )
  const cycleTab = useCallback((offset: number) => setTabs((state) => withTabCycled(state, offset)), [setTabs])
  /** For a folder that's gone from disk: closes every tab inside it. */
  const closeFolderTabs = useCallback(
    (folder: string) => setTabs((state) => withFolderClosed(state, folder)),
    [setTabs],
  )

  return {
    openInActiveTab,
    openInBackground,
    openFromClick,
    goBack,
    goForward,
    openInNewTab,
    addFolder,
    addFolderByPath,
    newTab,
    closeTab,
    closeActiveTab,
    closeOtherTabs,
    closeTabsToRight,
    activateTab,
    activateTabAt,
    cycleTab,
    closeFolderTabs,
  }
}
