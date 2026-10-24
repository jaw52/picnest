import type { MaybeRefOrGetter } from 'vue'
import type { PhotoOperation } from './usePhotoOperation'
import type { Gallery } from '~/state/gallery'
import type { Photo } from '~/types/photo'
import { useEventListener } from '@vueuse/core'
import { shallowRef } from 'vue'
import { useTabActive } from '~/context/tab'
import { t } from '~/i18n'
import { deletePhotos, restorePhotos } from '~/lib/backend'
import { message } from '~/lib/native'
import { successorOf } from '~/lib/photo'
import { useGallery } from '~/state/gallery'
import { useOpenFolder } from './useOpenFolder'
import { usePhotoOperation } from './usePhotoOperation'

// Shared by every deletion entry point in the window, whichever tab it is in.
const deletionPending = shallowRef(false)

/** The photos the user confirmed for deletion, or null if they cancelled. */
async function confirmTargets(gallery: Gallery, folderPath: string, photos: Photo[]): Promise<Photo[] | null> {
  return new Promise((resolve) => {
    gallery.deleteConfirmRequest.value = { folderPath, photos, resolve }
  })
}

/**
 * After `removed` were deleted, keeps the viewer open on the photo after
 * them, or - with the viewer closed - selects it in the grid.
 */
function moveOnFrom(gallery: Gallery, removed: ReadonlySet<string>, gridBefore: Photo[], previewBefore: Photo[]) {
  const previewId = gallery.previewPhotoId.value
  if (previewId === null)
    gallery.selectAfterRemoval(removed, gridBefore)
  else if (removed.has(previewId))
    gallery.setPreviewPhotoId(successorOf(previewBefore, removed)?.id ?? null)
}

const trash: PhotoOperation = async (gallery, folderPath, photos) => {
  if (photos.length > 1 && gallery.bulkDeleteBlocked.value)
    return null
  const targets = await confirmTargets(gallery, folderPath, photos)
  if (!targets || targets.length === 0)
    return null

  // What the grid and viewer showed, to pick the photo after the deleted
  // ones once they are gone.
  const gridBefore = gallery.filteredPhotos.value
  const previewBefore = gallery.previewPhotos.value

  try {
    const result = await deletePhotos(folderPath, targets.map(p => p.path))
    // The Photos library's deletions go to its Recently Deleted album,
    // which can't be undone from here.
    if (result.trashed.length > 0)
      gallery.undoableDeletion.value = { folderPath, trashed: result.trashed }
    const removed = new Set([...result.trashed.map(trashed => trashed.path), ...result.deleted])
    if (removed.size > 0 && gallery.currentFolder.value === folderPath)
      moveOnFrom(gallery, removed, gridBefore, previewBefore)
    return result.failures.map(failure => t('dialogs.deleteFailed', { error: failure }))
  }
  catch (error) {
    return [t('dialogs.deleteFailed', { error: String(error) })]
  }
}

export function useDeletePhoto(folderPath: MaybeRefOrGetter<string | null>): (photos: Photo[]) => Promise<void> {
  return usePhotoOperation(folderPath, deletionPending, () => t('dialogs.deletePhotosTitle'), trash)
}

/** Puts the last deleted photos back, selecting them in the grid. */
export function useUndoDeletion(): () => Promise<void> {
  const gallery = useGallery()
  const { refreshFolder } = useOpenFolder()

  return async () => {
    const deletion = gallery.undoableDeletion.value
    if (!deletion || deletionPending.value)
      return
    gallery.undoableDeletion.value = null
    let error: unknown
    try {
      await restorePhotos(deletion.folderPath, deletion.trashed)
    }
    catch (error_) {
      error = error_
    }
    if (gallery.currentFolder.value === deletion.folderPath) {
      await refreshFolder(deletion.folderPath)
      // The viewer, if open, kept the deleted photos' places in its list.
      const viewing = gallery.previewPhotoId.value !== null
      const shown = new Set((viewing ? gallery.previewPhotos : gallery.filteredPhotos).value.map(p => p.id))
      const restored = deletion.trashed.map(trashed => trashed.path).filter(path => shown.has(path))
      if (restored.length > 0 && viewing) {
        gallery.setPreviewPhotoId(restored[0])
      }
      else if (restored.length > 0) {
        gallery.selectedPhotoIds.value = new Set(restored)
        gallery.selectedPhotoId.value = restored[0]
        gallery.revealPhoto.value = { id: restored[0] }
      }
    }
    if (error !== undefined)
      await message(String(error), { title: t('dialogs.undoDeleteTitle'), kind: 'error' })
  }
}

/** ⌘Z undoes the last deletion, anywhere but in a text field (where it undoes typing). */
export function useUndoShortcut(): void {
  const undo = useUndoDeletion()
  const active = useTabActive()
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (!active.value || !e.metaKey || e.shiftKey || e.altKey || e.ctrlKey || e.key.toLowerCase() !== 'z')
      return
    const target = e.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))
      return
    e.preventDefault()
    void undo()
  })
}
