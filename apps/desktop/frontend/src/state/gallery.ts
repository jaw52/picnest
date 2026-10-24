import type { InjectionKey } from 'vue'
import type { PhotoGrouping, RatingFilter } from '~/lib/photo'
import type { FolderEntry } from '~/types/folder'
import type { DeleteConfirmRequest, ThumbnailProgress, UndoableDeletion } from '~/types/gallery'
import type { Photo } from '~/types/photo'
import { computed, inject, provide, shallowRef } from 'vue'
import { filterPhotosByRating, matchesRatingFilter, sortByTaken, successorOf } from '~/lib/photo'
import { persisted } from './persisted'

export const THUMBNAIL_WIDTH_MIN = 120
export const THUMBNAIL_WIDTH_MAX = 480
export const thumbnailWidth = persisted('picnest.thumbnailWidth', 240)
/** Whether, and by which period, the grid groups photos by when they were taken. */
export const photoGrouping = persisted<PhotoGrouping>('picnest.photoGrouping', null)

function samePaths(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((path, i) => path === b[i])
}

/**
 * Everything about the folder a tab shows: each tab has a gallery of its own
 * (see TabPane), the rest being the window's (thumbnail size, tabs,
 * settings).
 */
export function createGallery() {
  const currentFolder = shallowRef<string | null>(null)
  const photos = shallowRef<Photo[]>([])
  /** The open folder's subfolders, laid out ahead of its photos. */
  const subfolders = shallowRef<FolderEntry[]>([])
  /** Total photo count reported by the backend, ahead of `photos` fully loading in via pagination. */
  const photosTotal = shallowRef(0)
  const isScanning = shallowRef(false)
  /**
   * How many of the folder's photos have their thumbnail ready, out of all of
   * them - including those in pages still loading, so the total is known from
   * the first page and the bar only moves forward (see useThumbnailPrefetch).
   * Resets to { total: 0, done: 0 } once every one is ready, so the progress
   * bar disappears instead of showing a stale 100%.
   */
  const thumbnailProgress = shallowRef<ThumbnailProgress>({ total: 0, done: 0 })
  const ratingFilter = shallowRef<RatingFilter>(null)
  /**
   * Anchor of the grid selection - the last photo clicked without a modifier
   * key. Used as the fixed end of a shift-click range select; not itself a
   * source of truth for what's highlighted (see `selectedPhotoIds`).
   */
  const selectedPhotoId = shallowRef<string | null>(null)
  /** All photos currently highlighted in the grid. */
  const selectedPhotoIds = shallowRef<ReadonlySet<string>>(new Set())
  const previewIdBase = shallowRef<string | null>(null)
  /**
   * The photos the viewer pages through: the grid's, as they were when it
   * opened. Frozen, so rating a photo out of the filter doesn't pull it from
   * under the viewer.
   */
  const previewIds = shallowRef<string[]>([])
  /** A request for the grid to scroll a photo into view and focus it. */
  const revealPhoto = shallowRef<{ id: string } | null>(null)
  /** The photo whose info card is open (see PhotoInfoPopover), beside its tile. */
  const photoInfoId = shallowRef<string | null>(null)
  /** The photo whose name the info card should start editing. */
  const renamingPhotoId = shallowRef<string | null>(null)
  const undoableDeletion = shallowRef<UndoableDeletion | null>(null)
  /**
   * Non-null while the delete confirmation (see DeleteConfirmDialog) is open,
   * for one photo or many.
   */
  const deleteConfirmRequest = shallowRef<DeleteConfirmRequest | null>(null)

  /** Photos the backend reported that later pages haven't brought in yet. */
  const unloadedPhotos = computed(() => Math.max(0, photosTotal.value - photos.value.length))
  /**
   * Deleting several photos waits for the prefetch: its confirmation dialog
   * shows every photo's thumbnail, which must not mean decoding originals.
   */
  const bulkDeleteBlocked = computed(() => thumbnailProgress.value.total > 0)
  /** The photos in the grid, in its order: the newest first while grouped by when they were taken. */
  const filteredPhotos = computed(() => {
    const shown = filterPhotosByRating(photos.value, ratingFilter.value)
    return photoGrouping.value === null ? shown : sortByTaken(shown)
  })
  /**
   * Paths of every thumbnail-able photo in the folder, ignoring the rating
   * filter. Keeps its identity across rating edits so the prefetcher only
   * restarts when the set of files actually changes.
   */
  const prefetchPaths = computed<string[]>((previous) => {
    const paths = photos.value.filter(p => !p.isCloudPlaceholder).map(p => p.path)
    return previous && samePaths(previous, paths) ? previous : paths
  })
  /**
   * The grid's one Tab stop, as a listbox has: the last photo clicked or moved
   * to, else the first. Arrow keys move on from there.
   */
  const gridTabStopId = computed(() => {
    const anchorId = selectedPhotoId.value
    return filteredPhotos.value.some(p => p.id === anchorId) ? anchorId : filteredPhotos.value[0]?.id ?? null
  })
  /** The photos the viewer pages through, with their current ratings and names. */
  const previewPhotos = computed(() => {
    const byId = new Map(photos.value.map(p => [p.id, p]))
    return previewIds.value.flatMap(id => byId.get(id) ?? [])
  })
  /** Non-null while the full-size single-photo viewer is open. */
  const previewPhotoId = computed(() => previewIdBase.value)
  const previewPhoto = computed(() => {
    const id = previewIdBase.value
    return id ? photos.value.find(p => p.id === id) ?? null : null
  })

  let scanId = 0
  /**
   * Starts a scan of the tab's folder, superseding any before it: the
   * returned check is false once another one has started.
   */
  function startScan(): () => boolean {
    const id = ++scanId
    return () => scanId === id
  }

  /** Opens the viewer on `id`, or closes it for null, paging through the grid as it is now. */
  function setPreviewPhotoId(id: string | null): void {
    if (id === null)
      previewIds.value = []
    else if (previewIdBase.value === null)
      previewIds.value = filteredPhotos.value.map(p => p.id)
    previewIdBase.value = id
  }

  /** Selects just `id`, as a plain click does, and brings it into view. */
  function selectPhoto(id: string): void {
    selectedPhotoIds.value = new Set([id])
    selectedPhotoId.value = id
    revealPhoto.value = { id }
  }

  /**
   * Moves the selection on once the photos in `removed` leave the grid, which
   * showed `before`: selected photos that stay remain selected; if none does,
   * the photo after the removed ones is selected instead, so a delete or a
   * rating key can be pressed again for the next photo.
   */
  function selectAfterRemoval(removed: ReadonlySet<string>, before: readonly Photo[]): void {
    const selected = [...selectedPhotoIds.value]
    if (selected.every(id => !removed.has(id)))
      return
    const kept = new Set(selected.filter(id => !removed.has(id)))
    if (kept.size > 0) {
      selectedPhotoIds.value = kept
      const anchorId = selectedPhotoId.value
      if (anchorId && removed.has(anchorId))
        selectedPhotoId.value = null
      return
    }
    const next = successorOf(before, removed)
    if (next) {
      selectPhoto(next.id)
    }
    else {
      selectedPhotoIds.value = new Set()
      selectedPhotoId.value = null
    }
  }

  /**
   * Closes the viewer and selects, in the grid, the photo it was showing - or
   * the next one still in the grid, if that one was rated out of the filter.
   */
  function closePreview(): void {
    const id = previewIdBase.value
    if (id === null)
      return
    const shown = previewPhotos.value
    setPreviewPhotoId(null)
    const inGrid = new Set(filteredPhotos.value.map(p => p.id))
    const gone = new Set(shown.filter(p => !inGrid.has(p.id)).map(p => p.id))
    const target = inGrid.has(id) ? id : successorOf(shown, gone)?.id
    if (target)
      selectPhoto(target)
  }

  /**
   * Rates photos. Selected photos rated out of the filter leave the grid, so
   * the selection moves on to the photo after them, ready for the next rating.
   */
  function setPhotoRating(photoIds: string[], rating: number): void {
    const ids = new Set(photoIds)
    const before = filteredPhotos.value
    photos.value = photos.value.map(p => (ids.has(p.id) ? { ...p, rating } : p))
    if (!matchesRatingFilter({ rating }, ratingFilter.value))
      selectAfterRemoval(ids, before)
  }

  /**
   * Renames a photo in place (new `path`/`id`/`fileName`) rather than
   * rescanning the folder, so the selection, anchor, and open preview all
   * survive the rename instead of being dropped when the old id disappears.
   */
  function renamePhoto(photoId: string, newPath: string, newFileName: string): void {
    photos.value = photos.value.map(p =>
      p.id === photoId ? { ...p, id: newPath, path: newPath, fileName: newFileName } : p,
    )
    if (selectedPhotoIds.value.has(photoId)) {
      const next = new Set(selectedPhotoIds.value)
      next.delete(photoId)
      next.add(newPath)
      selectedPhotoIds.value = next
    }
    if (selectedPhotoId.value === photoId)
      selectedPhotoId.value = newPath
    previewIds.value = previewIds.value.map(id => (id === photoId ? newPath : id))
    if (previewIdBase.value === photoId)
      previewIdBase.value = newPath
  }

  return {
    currentFolder,
    photos,
    subfolders,
    photosTotal,
    isScanning,
    thumbnailProgress,
    ratingFilter,
    selectedPhotoId,
    selectedPhotoIds,
    revealPhoto,
    photoInfoId,
    renamingPhotoId,
    undoableDeletion,
    deleteConfirmRequest,
    unloadedPhotos,
    bulkDeleteBlocked,
    filteredPhotos,
    prefetchPaths,
    gridTabStopId,
    previewPhotos,
    previewPhotoId,
    previewPhoto,
    startScan,
    setPreviewPhotoId,
    selectPhoto,
    selectAfterRemoval,
    closePreview,
    setPhotoRating,
    renamePhoto,
  }
}

export type Gallery = ReturnType<typeof createGallery>

const galleryKey: InjectionKey<Gallery> = Symbol('gallery')

/** Gives the tab a gallery of its own, for everything inside it. */
export function provideGallery(): Gallery {
  const gallery = createGallery()
  provide(galleryKey, gallery)
  return gallery
}

/** The gallery of the tab this is used in. */
export function useGallery(): Gallery {
  const gallery = inject(galleryKey)
  if (!gallery)
    throw new Error('useGallery() needs a tab: call it under a TabPane')
  return gallery
}
