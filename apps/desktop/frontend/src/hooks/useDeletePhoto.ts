import type { Photo } from '~/types/photo'
import { atom, useStore } from 'jotai'
import { useCallback } from 'react'

import { currentFolderAtom } from '~/atoms/gallery'
import { deletePhotos } from '~/lib/backend'
import { ask, message } from '~/lib/native'

import { useOpenFolder } from './useOpenFolder'

// Shared by every deletion entry point in the same application store.
const deletionPendingAtom = atom(false)

export function useDeletePhoto(folderPath: string | null) {
  const store = useStore()
  const { refreshFolder } = useOpenFolder()

  return useCallback(
    async (photos: Photo[]) => {
      if (!folderPath || photos.length === 0 || store.get(deletionPendingAtom))
        return

      store.set(deletionPendingAtom, true)
      try {
        const confirmMessage
          = photos.length === 1
            ? `确定要将「${photos[0].fileName}」移到废纸篓吗？`
            : `确定要将选中的 ${photos.length} 张照片移到废纸篓吗？`

        const confirmed = await ask(confirmMessage, {
          title: '删除照片',
          kind: 'warning',
        })
        if (!confirmed)
          return

        const errors: string[] = []
        try {
          await deletePhotos(
            folderPath,
            photos.map(p => p.path),
          )
        }
        catch (error) {
          errors.push(`删除失败：${error}`)
        }
        // Refresh even after partial failure, without navigating back if the
        // user switched folders while the native trash operation was running.
        if (store.get(currentFolderAtom) === folderPath) {
          const refreshed = await refreshFolder(folderPath)
          if (!refreshed)
            errors.push('刷新目录失败，请手动重新扫描。')
        }
        if (errors.length > 0)
          await message(errors.join('\n'), { title: '删除照片', kind: 'error' })
      }
      finally {
        store.set(deletionPendingAtom, false)
      }
    },
    [folderPath, store, refreshFolder],
  )
}
