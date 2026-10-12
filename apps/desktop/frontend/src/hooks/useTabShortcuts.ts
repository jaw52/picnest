import { useEffect, useState } from 'react'
import { onFileDrop } from '~/lib/native'

import { useTabs } from './useTabs'

/**
 * Browser-style tab shortcuts: ⌘T new tab, ⌘W close tab, ⌘O add a folder,
 * ⌘1-⌘9 jump to a tab, ⌃Tab / ⌘⇧] next tab, ⌃⇧Tab / ⌘⇧[ previous tab.
 */
export function useTabShortcuts() {
  const { newTab, closeActiveTab, addFolder, activateTabAt, cycleTab } = useTabs()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        cycleTab(e.shiftKey ? -1 : 1)
        return
      }
      if (!e.metaKey || e.altKey || e.ctrlKey)
        return
      if (e.shiftKey) {
        // With Shift held, `e.key` is the shifted character on most layouts.
        if (e.code === 'BracketRight' || e.code === 'BracketLeft') {
          e.preventDefault()
          cycleTab(e.code === 'BracketRight' ? 1 : -1)
        }
        return
      }
      const key = e.key.toLowerCase()
      if (key === 't') {
        e.preventDefault()
        newTab()
      }
      else if (key === 'w') {
        e.preventDefault()
        closeActiveTab()
      }
      else if (key === 'o') {
        e.preventDefault()
        void addFolder()
      }
      else if (/^[1-9]$/.test(key)) {
        e.preventDefault()
        activateTabAt(Number(key))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [newTab, closeActiveTab, addFolder, activateTabAt, cycleTab])
}

/**
 * Folders dropped anywhere on the window are added and opened (see
 * `addFolderByPath`). Returns whether files are being dragged over the window.
 */
export function useFolderDrop() {
  const { addFolderByPath } = useTabs()
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  useEffect(
    () =>
      onFileDrop({
        onHover: setIsDraggingOver,
        onDrop: (paths) => {
          for (const path of paths) addFolderByPath(path)
        },
      }),
    [addFolderByPath],
  )

  return isDraggingOver
}
