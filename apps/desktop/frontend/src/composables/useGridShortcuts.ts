import type { GridDirection } from '~/lib/masonry'
import type { Photo } from '~/types/photo'
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import { useTabActive } from '~/context/tab'
import { ratingFromKey } from '~/lib/rating-key'
import { THUMBNAIL_WIDTH_MAX, THUMBNAIL_WIDTH_MIN, thumbnailWidth, useGallery } from '~/state/gallery'
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

function isPlainSpace(e: KeyboardEvent): boolean {
  return e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
}

const isDeleteKey = (e: KeyboardEvent) => e.key === 'Delete' || e.key === 'Backspace'

/** Whether arrow keys pressed on `target` are the grid's, rather than a tab list's or slider's. */
function isGridTarget(target: EventTarget | null): boolean {
  return !(target instanceof Element) || target === document.body || target.closest('[role="listbox"]') !== null
}

/** The photo to preview for a selection: the one last clicked if still selected, else the first. */
function previewTarget(photos: Photo[], selectedIds: ReadonlySet<string>, anchorId: string | null) {
  return photos.find(p => p.id === anchorId && selectedIds.has(p.id))
    ?? photos.find(p => selectedIds.has(p.id))
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
 * Grid keyboard shortcuts, active while the tab is shown, no photo is being
 * previewed and the bulk-delete confirmation is closed:
 * arrow keys move the selection (Shift extends it), Cmd/Ctrl+A selects every
 * photo shown (respecting the filter), Space previews the selection (as Quick
 * Look does in Finder), ⌘I shows its info, 0-5 rate it, Delete removes it,
 * ⌘= / ⌘- / ⌘0 resize the thumbnails.
 *
 * `neighbor` finds the photo an arrow key moves to from another, or the first
 * photo from none.
 */
export function useGridShortcuts(neighbor: (id: string | null, direction: GridDirection) => string | undefined): void {
  const gallery = useGallery()
  const { filteredPhotos, selectedPhotoIds, selectedPhotoId, currentFolder } = gallery
  const active = useTabActive()
  const enabled = computed(() =>
    active.value && gallery.previewPhotoId.value === null && gallery.deleteConfirmRequest.value === null)
  const deletePhoto = useDeletePhoto(currentFolder)
  const rate = useRatePhoto(currentFolder)
  // The moving end of a Shift+arrow range; the anchor is the fixed one.
  let lead: string | null = null

  const selected = () => filteredPhotos.value.filter(p => selectedPhotoIds.value.has(p.id))

  function moveSelection(direction: GridDirection, extend: boolean) {
    const photos = filteredPhotos.value
    const anchorId = selectedPhotoId.value
    const from = [lead, anchorId].find(id => id !== null && selectedPhotoIds.value.has(id)) ?? null
    const next = neighbor(from, direction)
    if (!next)
      return
    lead = next
    const anchorIndex = photos.findIndex(p => p.id === anchorId)
    const nextIndex = photos.findIndex(p => p.id === next)
    if (extend && anchorIndex !== -1 && nextIndex !== -1) {
      const [start, end] = anchorIndex < nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex]
      selectedPhotoIds.value = new Set(photos.slice(start, end + 1).map(p => p.id))
      gallery.revealPhoto.value = { id: next }
    }
    else {
      gallery.selectPhoto(next)
    }
  }

  function previewSelection(e: KeyboardEvent) {
    // Left alone on buttons (stars, toolbar), where Space means "press".
    if ((e.target as HTMLElement | null)?.tagName === 'BUTTON' || selectedPhotoIds.value.size === 0)
      return
    e.preventDefault()
    const photo = previewTarget(filteredPhotos.value, selectedPhotoIds.value, selectedPhotoId.value)
    if (photo && !e.repeat)
      gallery.setPreviewPhotoId(photo.id)
  }

  function showSelectionInfo(e: KeyboardEvent) {
    e.preventDefault()
    const photo = previewTarget(filteredPhotos.value, selectedPhotoIds.value, selectedPhotoId.value)
    if (photo)
      gallery.photoInfoId.value = photo.id
  }

  /** The keys that act on the selection or the grid: select all, info, preview, rate, delete, resize. */
  function onActionKey(e: KeyboardEvent) {
    const command = e.metaKey || e.ctrlKey
    const rating = ratingFromKey(e)
    const width = thumbnailWidthFromKey(e, thumbnailWidth.value)
    if (width !== undefined) {
      e.preventDefault()
      thumbnailWidth.value = width
    }
    else if (command && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selectedPhotoIds.value = new Set(filteredPhotos.value.map(p => p.id))
    }
    else if (command && e.key.toLowerCase() === 'i') {
      showSelectionInfo(e)
    }
    else if (isPlainSpace(e)) {
      previewSelection(e)
    }
    else if (rating !== null) {
      rate(selected(), rating)
    }
    else if (isDeleteKey(e) && !e.repeat && selectedPhotoIds.value.size > 0) {
      e.preventDefault()
      void deletePhoto(selected())
    }
  }

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (!enabled.value)
      return
    const target = e.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))
      return
    const direction = e.metaKey || e.ctrlKey || e.altKey ? undefined : ARROWS[e.key]
    if (!direction) {
      onActionKey(e)
      return
    }
    // Arrow keys on a tab list or slider are theirs.
    if (isGridTarget(target)) {
      e.preventDefault()
      moveSelection(direction, e.shiftKey)
    }
  })
}
