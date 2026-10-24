import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, reactive, toValue, watchEffect } from 'vue'
import { isICloudFolder } from '~/lib/backend'

/** Whether each folder is in iCloud Drive, asked once per folder. */
const iCloudFolders = reactive(new Map<string, boolean>())
const asked = new Set<string>()

/**
 * Whether a folder is in iCloud Drive (a synced Desktop or Documents folder
 * included); undefined until known.
 */
export function useIsICloudFolder(path: MaybeRefOrGetter<string | null>): ComputedRef<boolean | undefined> {
  watchEffect(() => {
    const folder = toValue(path)
    if (folder === null || asked.has(folder))
      return
    asked.add(folder)
    void isICloudFolder(folder)
      .catch(() => false)
      .then(iCloud => iCloudFolders.set(folder, iCloud))
  })
  return computed(() => {
    const folder = toValue(path)
    return folder === null ? undefined : iCloudFolders.get(folder)
  })
}
