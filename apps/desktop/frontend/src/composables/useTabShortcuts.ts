import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { onScopeDispose, shallowRef } from 'vue'
import { onFileDrop } from '~/lib/native'
import { activateTabAt, addFolder, addFolderByPath, closeActiveTab, cycleTab, goBack, goForward, newTab } from '~/state/tabs'

const BRACKET_STEPS: Partial<Record<string, number>> = { BracketLeft: -1, BracketRight: 1 }

const LETTERS: Partial<Record<string, () => void>> = { t: newTab, w: closeActiveTab, o: () => void addFolder() }

/** The tab action a key press stands for, if any. */
function actionFor(e: KeyboardEvent): (() => void) | undefined {
  if (e.ctrlKey && e.key === 'Tab')
    return () => cycleTab(e.shiftKey ? -1 : 1)
  if (!e.metaKey || e.altKey || e.ctrlKey)
    return undefined
  // `e.code`, since with Shift held `e.key` is the shifted character on most layouts.
  const bracket = BRACKET_STEPS[e.code]
  if (bracket !== undefined) {
    if (e.shiftKey)
      return () => cycleTab(bracket)
    return bracket < 0 ? goBack : goForward
  }
  if (e.shiftKey)
    return undefined
  const key = e.key.toLowerCase()
  if (/^[1-9]$/.test(key))
    return () => activateTabAt(Number(key))
  return LETTERS[key]
}

/**
 * Browser-style tab shortcuts: ⌘T new tab, ⌘W close tab, ⌘O add a folder,
 * ⌘1-⌘9 jump to a tab, ⌃Tab / ⌘⇧] next tab, ⌃⇧Tab / ⌘⇧[ previous tab,
 * ⌘[ / ⌘] (or a mouse's side buttons) back and forward.
 */
export function useTabShortcuts(): void {
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    const action = actionFor(e)
    if (action) {
      e.preventDefault()
      action()
    }
  })
  // Buttons 3 and 4 are a mouse's back and forward side buttons.
  useEventListener(window, 'mouseup', (e: MouseEvent) => {
    if (e.button === 3)
      goBack()
    else if (e.button === 4)
      goForward()
  })
}

/**
 * Folders dropped anywhere on the window are added to the new-tab page (see
 * `addFolderByPath`). Returns whether files are being dragged over the window.
 */
export function useFolderDrop(): Readonly<Ref<boolean>> {
  const isDraggingOver = shallowRef(false)
  const off = onFileDrop({
    onHover: (hovering) => {
      isDraggingOver.value = hovering
    },
    onDrop: (paths) => {
      for (const path of paths) addFolderByPath(path)
    },
  })
  onScopeDispose(off)
  return isDraggingOver
}
