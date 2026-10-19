import type { PhotoOperation } from './usePhotoOperation'
import { atom } from 'jotai'

import { i18n } from '~/i18n'
import { movePhotos, pickFolder } from '~/lib/backend'
import { isLibraryPath } from '~/lib/library'

import { usePhotoOperation } from './usePhotoOperation'

// Shared by every move entry point in the window, whichever tab it is in.
const movePendingAtom = atom(false)

const move: PhotoOperation = async (_store, folderPath, photos) => {
  // The Photos library's photos aren't files to move.
  if (isLibraryPath(folderPath))
    return null
  const title
    = photos.length === 1
      ? i18n.t('dialogs.movePhotoTo', { name: photos[0].fileName })
      : i18n.t('common.movePhotosTo', { count: photos.length })
  const destFolder = await pickFolder({ title, defaultPath: folderPath })
  if (!destFolder || destFolder === folderPath)
    return null

  try {
    await movePhotos(
      folderPath,
      photos.map(p => p.fileName),
      destFolder,
    )
    return []
  }
  catch (error) {
    return [String(error)]
  }
}

export function useMovePhotos(folderPath: string | null) {
  return usePhotoOperation(folderPath, movePendingAtom, 'dialogs.movePhotosTitle', move)
}
