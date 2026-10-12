import type { Photo } from '~/types/photo'
import { useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { renamePhotoAtom } from '~/atoms/gallery'
import { renamePhoto } from '~/lib/backend'
import { message } from '~/lib/native'

import { useOpenFolder } from './useOpenFolder'

export function useRenamePhoto(folderPath: string | null) {
  const renamePhotoInState = useSetAtom(renamePhotoAtom)
  const { refreshFolder } = useOpenFolder()

  return useCallback(
    async (photo: Photo, newFileName: string) => {
      const trimmed = newFileName.trim()
      if (!folderPath || trimmed === '' || trimmed.includes('/') || trimmed === photo.fileName)
        return

      const newPath = `${folderPath}/${trimmed}`
      // Optimistic: reflect the new name immediately, persist in the
      // background, and fall back to a full rescan if the backend rejects it
      // (e.g. a name collision) so the UI doesn't stay out of sync.
      renamePhotoInState(photo.id, newPath, trimmed)
      try {
        await renamePhoto(folderPath, photo.fileName, trimmed)
      }
      catch (error) {
        await message(`重命名失败：${error}`, { title: '重命名', kind: 'error' })
        await refreshFolder(folderPath)
      }
    },
    [folderPath, renamePhotoInState, refreshFolder],
  )
}
