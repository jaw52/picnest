import type { GridDirection } from '~/lib/masonry'
import type { Photo } from '~/types/photo'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  currentFolderAtom,
  deleteConfirmRequestAtom,
  filteredPhotosAtom,
  photoInfoIdAtom,
  previewPhotoIdAtom,
  revealPhotoAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  selectPhotoAtom,
  THUMBNAIL_WIDTH_MAX,
  THUMBNAIL_WIDTH_MIN,
  thumbnailWidthAtom,
} from '~/atoms/gallery'
import { ratingFromKey } from '~/lib/rating-key'
import { useDeletePhoto } from './useDeletePhoto'
import { useRatePhoto } from './useRatePhoto'

const DEFAULT_THUMBNAIL_WIDTH = 240
const THUMBNAIL_WIDTH_STEP = 40

const ARROWS: Partial<Record<string, GridDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function isPlainSpace(e: KeyboardEvent) {
  return e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
}

const isDeleteKey = (e: KeyboardEvent) => e.key === 'Delete' || e.key === 'Backspace'

/** Whether arrow keys pressed on `target` are the grid's, rather than a tab list's or slider's. */
function isGridTarget(target: EventTarget | null) {
  return !(target instanceof Element) || target === document.body || target.closest('[role="listbox"]') !== null
}

/** The photo to preview for a selection: the one last clicked if still selected, else the first. */
function previewTarget(photos: Photo[], selectedIds: ReadonlySet<string>, anchorId: string | null) {
  const photo = photos.find(p => p.id === anchorId && selectedIds.has(p.id))
    ?? photos.find(p => selectedIds.has(p.id))
  return photo && !photo.isCloudPlaceholder ? photo : undefined
}

const THUMBNAIL_WIDTH_STEPS: Partial<Record<string, number>> = {
  '=': THUMBNAIL_WIDTH_STEP,
  '+': THUMBNAIL_WIDTH_STEP,
  '-': -THUMBNAIL_WIDTH_STEP,
}

/**
 * The thumbnail width a ⌘= / ⌘- / ⌘0 press asks for, if it is one. Read from
 * `e.key`, so the numeric keypad's keys count too.
 */
function thumbnailWidthFromKey(e: KeyboardEvent, width: number): number | undefined {
  if (!e.metaKey || e.altKey || e.ctrlKey)
    return undefined
  const step = THUMBNAIL_WIDTH_STEPS[e.key]
  if (step !== undefined)
    return Math.min(THUMBNAIL_WIDTH_MAX, Math.max(THUMBNAIL_WIDTH_MIN, width + step))
  return e.key === '0' ? DEFAULT_THUMBNAIL_WIDTH : undefined
}

/**
 * Grid keyboard shortcuts, active while no photo is being previewed and the
 * bulk-delete confirmation is closed:
 * arrow keys move the selection (Shift extends it), Cmd/Ctrl+A selects every
 * photo shown (respecting the filter), Space previews the selection (as Quick
 * Look does in Finder), ⌘I shows its info, 0-5 rate it, Delete removes it,
 * ⌘= / ⌘- / ⌘0 resize the thumbnails.
 *
 * `neighbor` finds the photo an arrow key moves to from another, or the first
 * photo from none.
 */
export function useGridShortcuts(neighbor: (id: string | null, direction: GridDirection) => string | undefined) {
  const previewId = useAtomValue(previewPhotoIdAtom)
  const confirmingDelete = useAtomValue(deleteConfirmRequestAtom) !== null
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  const setInfoId = useSetAtom(photoInfoIdAtom)
  const photos = useAtomValue(filteredPhotosAtom)
  const folderPath = useAtomValue(currentFolderAtom)
  const selectedIds = useAtomValue(selectedPhotoIdsAtom)
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const anchorId = useAtomValue(selectedPhotoIdAtom)
  const selectPhoto = useSetAtom(selectPhotoAtom)
  const reveal = useSetAtom(revealPhotoAtom)
  const thumbnailWidth = useAtomValue(thumbnailWidthAtom)
  const setThumbnailWidth = useSetAtom(thumbnailWidthAtom)
  const deletePhoto = useDeletePhoto(folderPath)
  const rate = useRatePhoto(folderPath)
  // The moving end of a Shift+arrow range; the anchor is the fixed one.
  const leadRef = useRef<string | null>(null)

  useEffect(() => {
    if (previewId !== null || confirmingDelete)
      return

    const selected = () => photos.filter(p => selectedIds.has(p.id))

    function moveSelection(direction: GridDirection, extend: boolean) {
      const lead = [leadRef.current, anchorId].find(id => id !== null && selectedIds.has(id)) ?? null
      const next = neighbor(lead, direction)
      if (!next)
        return
      leadRef.current = next
      const anchorIndex = photos.findIndex(p => p.id === anchorId)
      const nextIndex = photos.findIndex(p => p.id === next)
      if (extend && anchorIndex !== -1 && nextIndex !== -1) {
        const [start, end] = anchorIndex < nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex]
        setSelectedIds(new Set(photos.slice(start, end + 1).map(p => p.id)))
        reveal({ id: next })
      }
      else {
        selectPhoto(next)
      }
    }

    function previewSelection(e: KeyboardEvent) {
      // Left alone on buttons (stars, toolbar), where Space means "press".
      if ((e.target as HTMLElement | null)?.tagName === 'BUTTON' || selectedIds.size === 0)
        return
      e.preventDefault()
      const photo = previewTarget(photos, selectedIds, anchorId)
      if (photo && !e.repeat)
        setPreviewId(photo.id)
    }

    function showSelectionInfo(e: KeyboardEvent) {
      e.preventDefault()
      const photo = previewTarget(photos, selectedIds, anchorId)
      if (photo)
        setInfoId(photo.id)
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))
        return

      const direction = e.metaKey || e.ctrlKey || e.altKey ? undefined : ARROWS[e.key]
      if (direction) {
        // Arrow keys on a tab list or slider are theirs.
        if (isGridTarget(target)) {
          e.preventDefault()
          moveSelection(direction, e.shiftKey)
        }
        return
      }

      const width = thumbnailWidthFromKey(e, thumbnailWidth)
      if (width !== undefined) {
        e.preventDefault()
        setThumbnailWidth(width)
      }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(photos.map(p => p.id)))
      }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        showSelectionInfo(e)
      }
      else if (isPlainSpace(e)) {
        previewSelection(e)
      }
      else if (ratingFromKey(e) !== null) {
        rate(selected(), ratingFromKey(e) as number)
      }
      else if (isDeleteKey(e) && !e.repeat && selectedIds.size > 0) {
        e.preventDefault()
        void deletePhoto(selected())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewId, confirmingDelete, selectedIds, anchorId, photos, thumbnailWidth, neighbor, deletePhoto, rate, setSelectedIds, setPreviewId, setInfoId, selectPhoto, reveal, setThumbnailWidth])
}
