import type { Photo } from '~/types/photo'
import { atom, useStore } from 'jotai'
import { useCallback } from 'react'

import { currentFolderAtom } from '~/atoms/gallery'
import { movePhotos, pickFolder } from '~/lib/backend'
import { message } from '~/lib/native'

import { useOpenFolder } from './useOpenFolder'

// Shared by every move entry point in the same application store.
const movePendingAtom = atom(false)

export function useMovePhotos(folderPath: string | null) {
  const store = useStore()
  const { refreshFolder } = useOpenFolder()

  return useCallback(
    async (photos: Photo[]) => {
      if (!folderPath || photos.length === 0 || store.get(movePendingAtom))
        return

      store.set(movePendingAtom, true)
      try {
        const title
          = photos.length === 1
            ? `移动「${photos[0].fileName}」到…`
            : `移动 ${photos.length} 张照片到…`
        const destFolder = await pickFolder({ title, defaultPath: folderPath })
        if (!destFolder || destFolder === folderPath)
          return

        const errors: string[] = []
        try {
          await movePhotos(
            folderPath,
            photos.map(p => p.fileName),
            destFolder,
          )
        }
        catch (error) {
          errors.push(`${error}`)
        }
        // Refresh even after partial failure, without navigating back if the
        // user switched folders while the move was running.
        if (store.get(currentFolderAtom) === folderPath) {
          const refreshed = await refreshFolder(folderPath)
          if (!refreshed)
            errors.push('刷新目录失败，请手动重新扫描。')
        }
        if (errors.length > 0)
          await message(errors.join('\n'), { title: '移动照片', kind: 'error' })
      }
      finally {
        store.set(movePendingAtom, false)
      }
    },
    [folderPath, store, refreshFolder],
  )
}
