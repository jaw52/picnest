import type { MaybeRefOrGetter } from 'vue'
import type { Photo } from '~/types/photo'
import { toValue } from 'vue'
import { t } from '~/i18n'
import { renamePhoto } from '~/lib/backend'
import { isLibraryPath } from '~/lib/library'
import { message } from '~/lib/native'
import { useGallery } from '~/state/gallery'
import { useOpenFolder } from './useOpenFolder'

export function useRenamePhoto(folderPath: MaybeRefOrGetter<string | null>): (photo: Photo, newFileName: string) => Promise<void> {
  const gallery = useGallery()
  const { refreshFolder } = useOpenFolder()

  return async (photo, newFileName) => {
    const folder = toValue(folderPath)
    const trimmed = newFileName.trim()
    if (!folder || isLibraryPath(folder) || trimmed === '' || trimmed.includes('/') || trimmed === photo.fileName)
      return

    const newPath = `${folder}/${trimmed}`
    // Optimistic: reflect the new name immediately, persist in the
    // background, and fall back to a full rescan if the backend rejects it
    // (e.g. a name collision) so the UI doesn't stay out of sync.
    gallery.renamePhoto(photo.id, newPath, trimmed)
    try {
      await renamePhoto(folder, photo.fileName, trimmed)
    }
    catch (error) {
      await message(t('dialogs.renameFailed', { error: String(error) }), { title: t('dialogs.renameTitle'), kind: 'error' })
      await refreshFolder(folder)
    }
  }
}
