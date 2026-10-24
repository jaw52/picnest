import type { MaybeRefOrGetter } from 'vue'
import type { Photo } from '~/types/photo'
import { shallowRef, toValue } from 'vue'
import { t } from '~/i18n'
import { downloadPlaceholder } from '~/lib/backend'
import { message } from '~/lib/native'
import { useGallery } from '~/state/gallery'
import { useOpenFolder } from './useOpenFolder'

/** Ids of photos whose iCloud download was requested and hasn't landed yet. */
export const downloadingIds = shallowRef<ReadonlySet<string>>(new Set<string>())

const POLL_MS = 2000
const MAX_POLLS = 30

const sleep = async (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function setDownloading(id: string, on: boolean) {
  const next = new Set(downloadingIds.value)
  if (on)
    next.add(id)
  else
    next.delete(id)
  downloadingIds.value = next
}

/**
 * Starts an iCloud download for a placeholder tile and re-scans until the
 * file is real (the backend returns as soon as the request is accepted).
 */
export function useDownloadPlaceholder(folderPath: MaybeRefOrGetter<string | null>): (photo: Photo) => Promise<void> {
  const gallery = useGallery()
  const { refreshFolder } = useOpenFolder()

  return async (photo) => {
    const folder = toValue(folderPath)
    if (!folder || downloadingIds.value.has(photo.id))
      return

    setDownloading(photo.id, true)
    try {
      await downloadPlaceholder(photo.path)
      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_MS)
        if (gallery.currentFolder.value !== folder)
          return
        await refreshFolder(folder)
        const current = gallery.photos.value.find(p => p.id === photo.id)
        if (!current || !current.isCloudPlaceholder)
          return
      }
    }
    catch (error) {
      await message(t('dialogs.downloadFailed', { error: String(error) }), { title: t('dialogs.downloadTitle'), kind: 'error' })
    }
    finally {
      setDownloading(photo.id, false)
    }
  }
}
