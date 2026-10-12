import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'

import { recentFoldersAtom, withFolderAdded } from '~/atoms/recentFolders'
import { activeTabPathAtom, tabsStateAtom } from '~/atoms/tabs'
import { pickFolder } from '~/lib/backend'
import {
  withFolderClosed,
  withPathOpened,
  withPathOpenedInNewTab,
  withTabActivated,
  withTabClosed,
  withTabCycled,
  withTabOpened,
} from '~/lib/tabs'

import { useOpenFolder } from './useOpenFolder'

export function useTabs() {
  const setTabs = useSetAtom(tabsStateAtom)
  const setRecentFolders = useSetAtom(recentFoldersAtom)

  /** Shows `path` in the active tab (moving up or down folders in the path bar). */
  const openInActiveTab = useCallback(
    (path: string) => setTabs(state => withPathOpened(state, path)),
    [setTabs],
  )

  /** Opens `path` in its own tab; the new-tab page it was picked from stays open. */
  const openInNewTab = useCallback(
    (path: string) => setTabs(state => withPathOpenedInNewTab(state, path)),
    [setTabs],
  )

  /** Bookmarks `path` and opens it in its own tab. */
  const addFolderByPath = useCallback(
    (path: string) => {
      setRecentFolders(prev => withFolderAdded(prev, path))
      openInNewTab(path)
    },
    [setRecentFolders, openInNewTab],
  )

  const addFolder = useCallback(async () => {
    const folder = await pickFolder()
    if (folder)
      addFolderByPath(folder)
  }, [addFolderByPath])

  const newTab = useCallback(() => setTabs(state => withTabOpened(state)), [setTabs])
  const closeTab = useCallback((id: string) => setTabs(state => withTabClosed(state, id)), [setTabs])
  const activateTab = useCallback(
    (id: string) => setTabs(state => withTabActivated(state, id)),
    [setTabs],
  )
  const closeActiveTab = useCallback(
    () => setTabs(state => withTabClosed(state, state.activeId)),
    [setTabs],
  )
  /** ⌘1-⌘8 pick a tab by position; ⌘9 always picks the last one, as in browsers. */
  const activateTabAt = useCallback(
    (position: number) =>
      setTabs((state) => {
        const tab = position === 9 ? state.tabs.at(-1) : state.tabs[position - 1]
        return tab ? withTabActivated(state, tab.id) : state
      }),
    [setTabs],
  )
  const cycleTab = useCallback(
    (offset: number) => setTabs(state => withTabCycled(state, offset)),
    [setTabs],
  )
  /** For a folder that's gone from disk: closes every tab inside it. */
  const closeFolderTabs = useCallback(
    (folder: string) => setTabs(state => withFolderClosed(state, folder)),
    [setTabs],
  )

  return {
    openInActiveTab,
    openInNewTab,
    addFolder,
    addFolderByPath,
    newTab,
    closeTab,
    closeActiveTab,
    activateTab,
    activateTabAt,
    cycleTab,
    closeFolderTabs,
  }
}

/**
 * Keeps the gallery showing the active tab's folder: switching tabs (or
 * restoring them on launch) rescans that folder; the new-tab page clears it.
 * Only one folder is loaded at a time.
 */
export function useActiveTabSync() {
  const path = useAtomValue(activeTabPathAtom)
  const { navigateToFolder, closeFolder } = useOpenFolder()
  const { closeFolderTabs } = useTabs()

  useEffect(() => {
    if (path === null) {
      closeFolder()
      return
    }
    void navigateToFolder(path).then((ok) => {
      if (!ok)
        closeFolderTabs(path)
    })
  }, [path, navigateToFolder, closeFolder, closeFolderTabs])
}
