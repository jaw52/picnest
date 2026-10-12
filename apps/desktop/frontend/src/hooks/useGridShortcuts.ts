import type { Photo } from '~/types/photo'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import {
  currentFolderAtom,
  filteredPhotosAtom,
  previewPhotoIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { infoSidebarCollapsedAtom } from '~/atoms/layout'
import { ratingFromKey } from '~/lib/rating-key'
import { useDeletePhoto } from './useDeletePhoto'
import { useRatePhoto } from './useRatePhoto'

function isPlainSpace(e: KeyboardEvent) {
  return e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
}

const isDeleteKey = (e: KeyboardEvent) => e.key === 'Delete' || e.key === 'Backspace'

/** The photo to preview for a selection: the one last clicked if still selected, else the first. */
function previewTarget(photos: Photo[], selectedIds: ReadonlySet<string>, anchorId: string | null) {
  const photo = photos.find(p => p.id === anchorId && selectedIds.has(p.id))
    ?? photos.find(p => selectedIds.has(p.id))
  return photo && !photo.isCloudPlaceholder ? photo : undefined
}

/**
 * Grid keyboard shortcuts, active while no photo is being previewed:
 * Cmd/Ctrl+A selects every photo shown (respecting the filter), Space previews
 * the selection (as Quick Look does in Finder), 0-5 rate it, Delete removes it.
 */
export function useGridShortcuts() {
  const previewId = useAtomValue(previewPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  const photos = useAtomValue(filteredPhotosAtom)
  const folderPath = useAtomValue(currentFolderAtom)
  const selectedIds = useAtomValue(selectedPhotoIdsAtom)
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const anchorId = useAtomValue(selectedPhotoIdAtom)
  const setInfoCollapsed = useSetAtom(infoSidebarCollapsedAtom)
  const deletePhoto = useDeletePhoto(folderPath)
  const rate = useRatePhoto(folderPath)

  useEffect(() => {
    if (previewId !== null)
      return

    const selected = () => photos.filter(p => selectedIds.has(p.id))

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))
        return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(photos.map(p => p.id)))
        setInfoCollapsed(false)
      }
      else if (isPlainSpace(e)) {
        // Left alone on buttons (stars, toolbar), where Space means "press".
        if (target?.tagName === 'BUTTON' || selectedIds.size === 0)
          return
        e.preventDefault()
        const photo = previewTarget(photos, selectedIds, anchorId)
        if (photo && !e.repeat)
          setPreviewId(photo.id)
      }
      else if (ratingFromKey(e) !== null) {
        const rating = ratingFromKey(e) as number
        for (const photo of selected())
          rate(photo, rating)
      }
      else if (isDeleteKey(e) && !e.repeat && selectedIds.size > 0) {
        e.preventDefault()
        void deletePhoto(selected())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewId, selectedIds, anchorId, photos, deletePhoto, rate, setSelectedIds, setInfoCollapsed, setPreviewId])
}
