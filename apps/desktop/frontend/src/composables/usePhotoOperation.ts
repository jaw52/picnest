import type { MaybeRefOrGetter, Ref } from 'vue'
import type { Gallery } from '~/state/gallery'
import type { Photo } from '~/types/photo'
import { toValue } from 'vue'
import { t } from '~/i18n'
import { message } from '~/lib/native'
import { useGallery } from '~/state/gallery'
import { useOpenFolder } from './useOpenFolder'

/**
 * Changes photos on disk: the errors it ran into, or null if it was called
 * off before touching anything.
 */
export type PhotoOperation = (
  gallery: Gallery,
  folderPath: string,
  photos: Photo[],
) => Promise<string[] | null>

/**
 * Runs `operation` on photos in a folder, one run at a time per `pending`.
 * Once it is done the folder is rescanned and any errors are shown under
 * `errorTitle`.
 */
export function usePhotoOperation(
  folderPath: MaybeRefOrGetter<string | null>,
  pending: Ref<boolean>,
  errorTitle: () => string,
  operation: PhotoOperation,
): (photos: Photo[]) => Promise<void> {
  const gallery = useGallery()
  const { refreshFolder } = useOpenFolder()

  return async (photos) => {
    const folder = toValue(folderPath)
    if (!folder || photos.length === 0 || pending.value)
      return

    pending.value = true
    try {
      const errors = await operation(gallery, folder, photos)
      if (!errors)
        return
      // Refresh even after partial failure, without navigating back if the
      // user switched folders while the operation was running.
      if (gallery.currentFolder.value === folder) {
        const refreshed = await refreshFolder(folder)
        if (!refreshed)
          errors.push(t('common.rescanFailed'))
      }
      if (errors.length > 0)
        await message(errors.join('\n'), { title: errorTitle(), kind: 'error' })
    }
    finally {
      pending.value = false
    }
  }
}
