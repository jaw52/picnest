import type { PhotoGrouping, RatingFilter } from '~/lib/photo'
import type { TrashedPhoto } from '~/mygo'
import type { FolderEntry } from '~/types/folder'
import type { Photo } from '~/types/photo'

import { atom } from 'jotai'
import { atomWithStorage, selectAtom } from 'jotai/utils'
import { filterPhotosByRating, matchesRatingFilter, sortByTaken, successorOf } from '~/lib/photo'

export const currentFolderAtom = atom<string | null>(null)
export const photosAtom = atom<Photo[]>([])
/** The open folder's subfolders, laid out ahead of its photos. */
export const subfoldersAtom = atom<FolderEntry[]>([])
/** Total photo count reported by the backend, ahead of `photosAtom` fully loading in via pagination. */
export const photosTotalAtom = atom<number>(0)
export const isScanningAtom = atom<boolean>(false)
export const THUMBNAIL_WIDTH_MIN = 120
export const THUMBNAIL_WIDTH_MAX = 480
export const thumbnailWidthAtom = atomWithStorage('picnest.thumbnailWidth', 240)
/** Photos the backend reported that later pages haven't brought in yet. */
export const unloadedPhotosAtom = atom(get => Math.max(0, get(photosTotalAtom) - get(photosAtom).length))
/**
 * How many of the folder's photos have their thumbnail ready, out of all of
 * them - including those in pages still loading, so the total is known from
 * the first page and the bar only moves forward (see useThumbnailPrefetch).
 * Resets to { total: 0, done: 0 } once every one is ready, so the progress
 * bar disappears instead of showing a stale 100%.
 */
export const thumbnailProgressAtom = atom<{ total: number, done: number }>({
  total: 0,
  done: 0,
})
/**
 * Deleting several photos waits for the prefetch: its confirmation dialog
 * shows every photo's thumbnail, which must not mean decoding originals.
 */
export const bulkDeleteBlockedAtom = atom(get => get(thumbnailProgressAtom).total > 0)
export const ratingFilterAtom = atom<RatingFilter>(null)
/** Whether, and by which period, the grid groups photos by when they were taken. */
export const photoGroupingAtom = atomWithStorage<PhotoGrouping>('picnest.photoGrouping', null)
/** The latest scan of the tab's folder; an older one's pages are dropped. */
export const scanIdAtom = atom(0)
/**
 * Anchor of the grid selection - the last photo clicked without a modifier
 * key. Used as the fixed end of a shift-click range select; not itself a
 * source of truth for what's highlighted (see `selectedPhotoIdsAtom`).
 */
export const selectedPhotoIdAtom = atom<string | null>(null)
/** All photos currently highlighted in the grid. */
export const selectedPhotoIdsAtom = atom(new Set<string>())
const previewIdBaseAtom = atom<string | null>(null)
/**
 * The photos the viewer pages through: the grid's, as they were when it
 * opened. Frozen, so rating a photo out of the filter doesn't pull it from
 * under the viewer.
 */
const previewIdsAtom = atom<string[]>([])

/** Non-null while the full-size single-photo viewer is open. */
export const previewPhotoIdAtom = atom(
  get => get(previewIdBaseAtom),
  (get, set, id: string | null) => {
    if (id === null)
      set(previewIdsAtom, [])
    else if (get(previewIdBaseAtom) === null)
      set(previewIdsAtom, get(filteredPhotosAtom).map(p => p.id))
    set(previewIdBaseAtom, id)
  },
)

/** A request for the grid to scroll a photo into view and focus it. */
export const revealPhotoAtom = atom<{ id: string } | null>(null)

/** Selects just `id`, as a plain click does, and brings it into view. */
export const selectPhotoAtom = atom(null, (_get, set, id: string) => {
  set(selectedPhotoIdsAtom, new Set([id]))
  set(selectedPhotoIdAtom, id)
  set(revealPhotoAtom, { id })
})

/** The photo whose info card is open (see PhotoInfoPopover), beside its tile. */
export const photoInfoIdAtom = atom<string | null>(null)

/** The photo whose name the info card should start editing. */
export const renamingPhotoIdAtom = atom<string | null>(null)

/** The last deletion, while it can still be undone. */
export interface UndoableDeletion {
  folderPath: string
  trashed: TrashedPhoto[]
}
export const undoableDeletionAtom = atom<UndoableDeletion | null>(null)

/**
 * Moves the selection on once the photos in `removed` leave the grid, which
 * showed `before`: selected photos that stay remain selected; if none does,
 * the photo after the removed ones is selected instead, so a delete or a
 * rating key can be pressed again for the next photo.
 */
export const selectAfterRemovalAtom = atom(
  null,
  (get, set, removed: ReadonlySet<string>, before: readonly Photo[]) => {
    const selected = get(selectedPhotoIdsAtom)
    if (![...selected].some(id => removed.has(id)))
      return
    const kept = new Set([...selected].filter(id => !removed.has(id)))
    if (kept.size > 0) {
      set(selectedPhotoIdsAtom, kept)
      const anchorId = get(selectedPhotoIdAtom)
      if (anchorId && removed.has(anchorId))
        set(selectedPhotoIdAtom, null)
      return
    }
    const next = successorOf(before, removed)
    if (next) {
      set(selectPhotoAtom, next.id)
    }
    else {
      set(selectedPhotoIdsAtom, new Set())
      set(selectedPhotoIdAtom, null)
    }
  },
)

export interface DeleteConfirmRequest {
  folderPath: string
  photos: Photo[]
  /** The photos the user still wants deleted, or null if they cancelled. */
  resolve: (photos: Photo[] | null) => void
}

/**
 * Non-null while the delete confirmation (see DeleteConfirmDialog) is open,
 * for one photo or many.
 */
export const deleteConfirmRequestAtom = atom<DeleteConfirmRequest | null>(null)

/** The photos in the grid, in its order: the newest first while grouped by when they were taken. */
export const filteredPhotosAtom = atom((get) => {
  const photos = filterPhotosByRating(get(photosAtom), get(ratingFilterAtom))
  return get(photoGroupingAtom) === null ? photos : sortByTaken(photos)
})

/**
 * Paths of every thumbnail-able photo in the folder, ignoring the rating
 * filter. Keeps its identity across rating edits so the prefetcher only
 * restarts when the set of files actually changes.
 */
export const prefetchPathsAtom = selectAtom(
  photosAtom,
  photos => photos.filter(p => !p.isCloudPlaceholder).map(p => p.path),
  (a, b) => a.length === b.length && a.every((path, i) => path === b[i]),
)

/**
 * The grid's one Tab stop, as a listbox has: the last photo clicked or moved
 * to, else the first. Arrow keys move on from there.
 */
export const gridTabStopIdAtom = atom((get) => {
  const photos = get(filteredPhotosAtom)
  const anchorId = get(selectedPhotoIdAtom)
  return photos.some(p => p.id === anchorId) ? anchorId : photos[0]?.id ?? null
})

/** The photos the viewer pages through, with their current ratings and names. */
export const previewPhotosAtom = atom((get) => {
  const byId = new Map(get(photosAtom).map(p => [p.id, p]))
  return get(previewIdsAtom).flatMap(id => byId.get(id) ?? [])
})

export const previewPhotoAtom = atom((get) => {
  const id = get(previewPhotoIdAtom)
  if (!id)
    return null
  return get(photosAtom).find(p => p.id === id) ?? null
})

/**
 * Closes the viewer and selects, in the grid, the photo it was showing - or
 * the next one still in the grid, if that one was rated out of the filter.
 */
export const closePreviewAtom = atom(null, (get, set) => {
  const id = get(previewPhotoIdAtom)
  if (id === null)
    return
  const shown = get(previewPhotosAtom)
  set(previewPhotoIdAtom, null)
  const inGrid = new Set(get(filteredPhotosAtom).map(p => p.id))
  const gone = new Set(shown.filter(p => !inGrid.has(p.id)).map(p => p.id))
  const target = inGrid.has(id) ? id : successorOf(shown, gone)?.id
  if (target)
    set(selectPhotoAtom, target)
})

/**
 * Rates photos. Selected photos rated out of the filter leave the grid, so
 * the selection moves on to the photo after them, ready for the next rating.
 */
export const setPhotoRatingAtom = atom(null, (get, set, photoIds: string[], rating: number) => {
  const ids = new Set(photoIds)
  const before = get(filteredPhotosAtom)
  set(
    photosAtom,
    get(photosAtom).map(p => (ids.has(p.id) ? { ...p, rating } : p)),
  )
  if (!matchesRatingFilter({ rating }, get(ratingFilterAtom)))
    set(selectAfterRemovalAtom, ids, before)
})

/**
 * Renames a photo in place (new `path`/`id`/`fileName`) rather than
 * rescanning the folder, so the selection, anchor, and open preview all
 * survive the rename instead of being dropped when the old id disappears.
 */
export const renamePhotoAtom = atom(
  null,
  (get, set, photoId: string, newPath: string, newFileName: string) => {
    set(
      photosAtom,
      get(photosAtom).map(p =>
        p.id === photoId ? { ...p, id: newPath, path: newPath, fileName: newFileName } : p,
      ),
    )
    set(selectedPhotoIdsAtom, (prev) => {
      if (!prev.has(photoId))
        return prev
      const next = new Set(prev)
      next.delete(photoId)
      next.add(newPath)
      return next
    })
    if (get(selectedPhotoIdAtom) === photoId)
      set(selectedPhotoIdAtom, newPath)
    set(previewIdsAtom, ids => ids.map(id => (id === photoId ? newPath : id)))
    if (get(previewPhotoIdAtom) === photoId)
      set(previewPhotoIdAtom, newPath)
  },
)

/**
 * The atoms each tab has a copy of: everything about the folder it shows,
 * the rest being the window's (thumbnail size, tabs, settings). Atoms
 * derived from them are the tab's too, read in it.
 */
export const galleryTabAtoms = [
  currentFolderAtom,
  photosAtom,
  subfoldersAtom,
  photosTotalAtom,
  isScanningAtom,
  scanIdAtom,
  thumbnailProgressAtom,
  ratingFilterAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  previewIdBaseAtom,
  previewIdsAtom,
  revealPhotoAtom,
  photoInfoIdAtom,
  renamingPhotoIdAtom,
  undoableDeletionAtom,
  deleteConfirmRequestAtom,
]
