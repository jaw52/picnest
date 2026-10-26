import type { ParseKeys } from 'i18next'
import type { PrimitiveAtom } from 'jotai'
import { useStore } from 'jotai'
import { useCallback } from 'react'

import { currentFolderAtom } from '~/atoms/gallery'
import { i18n } from '~/i18n'
import { message } from '~/lib/native'
import type { Photo } from '~/types/photo'

import { useOpenFolder } from './useOpenFolder'

/**
 * Changes photos on disk: the errors it ran into, or null if it was called
 * off before touching anything.
 */
export type PhotoOperation = (
  store: ReturnType<typeof useStore>,
  folderPath: string,
  photos: Photo[],
) => Promise<string[] | null>

/**
 * Runs `operation` on photos in a folder, one run at a
 * time per `pendingAtom`. Once it is done the folder is rescanned and any
 * errors are shown under the `errorTitle` translation.
 */
export function usePhotoOperation(
  folderPath: string | null,
  pendingAtom: PrimitiveAtom<boolean>,
  errorTitle: ParseKeys,
  operation: PhotoOperation,
) {
  const store = useStore()
  const { refreshFolder } = useOpenFolder()

  return useCallback(
    async (photos: Photo[]) => {
      if (!folderPath || photos.length === 0 || store.get(pendingAtom)) return

      store.set(pendingAtom, true)
      try {
        const errors = await operation(store, folderPath, photos)
        if (!errors) return
        // Refresh even after partial failure, without navigating back if the
        // user switched folders while the operation was running.
        if (store.get(currentFolderAtom) === folderPath) {
          const refreshed = await refreshFolder(folderPath)
          if (!refreshed) errors.push(i18n.t('common.rescanFailed'))
        }
        if (errors.length > 0) await message(errors.join('\n'), { title: i18n.t(errorTitle), kind: 'error' })
      } finally {
        store.set(pendingAtom, false)
      }
    },
    [folderPath, pendingAtom, errorTitle, operation, store, refreshFolder],
  )
}
