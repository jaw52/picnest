import type { MaybeRefOrGetter } from 'vue'
import { toValue, watch } from 'vue'
import { useOpenFolder } from '~/composables/useOpenFolder'
import { unwatchFolder, watchFolder } from '~/lib/backend'
import { events } from '~/mygo'
import { closeFolderTabs } from '~/state/tabs'

/**
 * Keeps the tab's gallery showing its folder, shown or not: loads it as the
 * tab goes to it, watches it, and rescans it as it changes on disk.
 */
export function useTabSync(path: MaybeRefOrGetter<string | null>): void {
  const { navigateToFolder, refreshFolder, closeFolder } = useOpenFolder()

  watch(() => toValue(path), (folder, _, onCleanup) => {
    if (folder === null) {
      closeFolder()
      return
    }
    void navigateToFolder(folder).then((ok) => {
      if (!ok)
        closeFolderTabs(folder)
    })

    void watchFolder(folder).catch((error: unknown) => console.warn(`failed to watch folder ${folder}:`, error))
    // Files added, removed or renamed outside the app show up without a
    // rescan by hand; the backend debounces bursts of changes.
    const off = events.folderChanged.on((changed) => {
      if (changed === folder)
        void refreshFolder(folder)
    })
    onCleanup(() => {
      off()
      void unwatchFolder(folder).catch((error: unknown) => console.warn(`failed to stop watching ${folder}:`, error))
    })
  }, { immediate: true })
}
