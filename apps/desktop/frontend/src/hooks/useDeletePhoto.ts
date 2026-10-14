import type { Photo } from '~/types/photo'
import { atom, useStore } from 'jotai'
import { useCallback, useEffect } from 'react'

import {
  bulkDeleteBlockedAtom,
  currentFolderAtom,
  deleteConfirmRequestAtom,
  filteredPhotosAtom,
  previewPhotoIdAtom,
  previewPhotosAtom,
  revealPhotoAtom,
  selectAfterRemovalAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  undoableDeletionAtom,
} from '~/atoms/gallery'
import { deletePhotos, restorePhotos } from '~/lib/backend'
import { message } from '~/lib/native'
import { successorOf } from '~/lib/photo'

import { useOpenFolder } from './useOpenFolder'

// Shared by every deletion entry point in the same application store.
const deletionPendingAtom = atom(false)

/** The photos the user confirmed for deletion, or null if they cancelled. */
async function confirmTargets(
  store: ReturnType<typeof useStore>,
  folderPath: string,
  photos: Photo[],
): Promise<Photo[] | null> {
  return new Promise((resolve) => {
    store.set(deleteConfirmRequestAtom, { folderPath, photos, resolve })
  })
}

/**
 * After `removed` were deleted, keeps the viewer open on the photo after
 * them, or - with the viewer closed - selects it in the grid.
 */
function moveOnFrom(
  store: ReturnType<typeof useStore>,
  removed: ReadonlySet<string>,
  gridBefore: Photo[],
  previewBefore: Photo[],
) {
  const previewId = store.get(previewPhotoIdAtom)
  if (previewId === null)
    store.set(selectAfterRemovalAtom, removed, gridBefore)
  else if (removed.has(previewId))
    store.set(previewPhotoIdAtom, successorOf(previewBefore, removed)?.id ?? null)
}

export function useDeletePhoto(folderPath: string | null) {
  const store = useStore()
  const { refreshFolder } = useOpenFolder()

  return useCallback(
    async (photos: Photo[]) => {
      if (!folderPath || photos.length === 0 || store.get(deletionPendingAtom))
        return
      if (photos.length > 1 && store.get(bulkDeleteBlockedAtom))
        return

      store.set(deletionPendingAtom, true)
      try {
        const targets = await confirmTargets(store, folderPath, photos)
        if (!targets || targets.length === 0)
          return

        // What the grid and viewer showed, to pick the photo after the
        // deleted ones once they are gone.
        const gridBefore = store.get(filteredPhotosAtom)
        const previewBefore = store.get(previewPhotosAtom)

        const errors: string[] = []
        try {
          const result = await deletePhotos(
            folderPath,
            targets.map(p => p.path),
          )
          errors.push(...result.failures.map(failure => `删除失败：${failure}`))
          if (result.trashed.length > 0) {
            store.set(undoableDeletionAtom, { folderPath, trashed: result.trashed })
            if (store.get(currentFolderAtom) === folderPath)
              moveOnFrom(store, new Set(result.trashed.map(t => t.path)), gridBefore, previewBefore)
          }
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

/** Puts the last deleted photos back, selecting them in the grid. */
export function useUndoDeletion() {
  const store = useStore()
  const { refreshFolder } = useOpenFolder()

  return useCallback(async () => {
    const deletion = store.get(undoableDeletionAtom)
    if (!deletion || store.get(deletionPendingAtom))
      return
    store.set(undoableDeletionAtom, null)
    let error: unknown
    try {
      await restorePhotos(deletion.folderPath, deletion.trashed)
    }
    catch (e) {
      error = e
    }
    if (store.get(currentFolderAtom) === deletion.folderPath) {
      await refreshFolder(deletion.folderPath)
      // The viewer, if open, kept the deleted photos' places in its list.
      const viewing = store.get(previewPhotoIdAtom) !== null
      const shown = new Set(store.get(viewing ? previewPhotosAtom : filteredPhotosAtom).map(p => p.id))
      const restored = deletion.trashed.map(t => t.path).filter(path => shown.has(path))
      if (restored.length > 0 && viewing) {
        store.set(previewPhotoIdAtom, restored[0])
      }
      else if (restored.length > 0) {
        store.set(selectedPhotoIdsAtom, new Set(restored))
        store.set(selectedPhotoIdAtom, restored[0])
        store.set(revealPhotoAtom, { id: restored[0] })
      }
    }
    if (error !== undefined)
      await message(`${error}`, { title: '撤销删除', kind: 'error' })
  }, [store, refreshFolder])
}

/** ⌘Z undoes the last deletion, anywhere but in a text field (where it undoes typing). */
export function useUndoShortcut() {
  const undo = useUndoDeletion()
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.metaKey || e.shiftKey || e.altKey || e.ctrlKey || e.key.toLowerCase() !== 'z')
        return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))
        return
      e.preventDefault()
      void undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])
}
