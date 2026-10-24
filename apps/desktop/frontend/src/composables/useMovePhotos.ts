import type { MaybeRefOrGetter } from 'vue'
import type { PhotoOperation } from './usePhotoOperation'
import type { Photo } from '~/types/photo'
import { shallowRef } from 'vue'
import { t } from '~/i18n'
import { movePhotos, pickFolder } from '~/lib/backend'
import { isLibraryPath } from '~/lib/library'
import { usePhotoOperation } from './usePhotoOperation'

// Shared by every move entry point in the window, whichever tab it is in.
const movePending = shallowRef(false)

const move: PhotoOperation = async (_gallery, folderPath, photos) => {
  // The Photos library's photos aren't files to move.
  if (isLibraryPath(folderPath))
    return null
  const title = photos.length === 1
    ? t('dialogs.movePhotoTo', { name: photos[0].fileName })
    : t('common.movePhotosTo', photos.length)
  const destFolder = await pickFolder({ title, defaultPath: folderPath })
  if (!destFolder || destFolder === folderPath)
    return null

  try {
    await movePhotos(folderPath, photos.map(p => p.fileName), destFolder)
    return []
  }
  catch (error) {
    return [String(error)]
  }
}

export function useMovePhotos(folderPath: MaybeRefOrGetter<string | null>): (photos: Photo[]) => Promise<void> {
  return usePhotoOperation(folderPath, movePending, () => t('dialogs.movePhotosTitle'), move)
}
