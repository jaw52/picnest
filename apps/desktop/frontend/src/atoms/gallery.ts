import type { RatingFilter } from '~/lib/photo'
import type { FolderEntry } from '~/types/folder'
import type { Photo } from '~/types/photo'

import { atom } from 'jotai'
import { atomWithStorage, selectAtom } from 'jotai/utils'
import { filterPhotosByRating } from '~/lib/photo'

export const currentFolderAtom = atom<string | null>(null)
export const photosAtom = atom<Photo[]>([])
/** The open folder's subfolders, laid out ahead of its photos. */
export const subfoldersAtom = atom<FolderEntry[]>([])
/** Total photo count reported by the backend, ahead of `photosAtom` fully loading in via pagination. */
export const photosTotalAtom = atom<number>(0)
export const isScanningAtom = atom<boolean>(false)
export const thumbnailWidthAtom = atomWithStorage('picnest.thumbnailWidth', 240)
/**
 * Tracks the folder's background thumbnail prefetch (see
 * useThumbnailPrefetch); on-screen tiles don't count, so each photo is
 * counted once. Resets to { total: 0, done: 0 } once the prefetch drains, so
 * the progress bar disappears instead of showing a stale 100%.
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
/**
 * Anchor of the grid selection - the last photo clicked without a modifier
 * key. Used as the fixed end of a shift-click range select; not itself a
 * source of truth for what's highlighted (see `selectedPhotoIdsAtom`).
 */
export const selectedPhotoIdAtom = atom<string | null>(null)
/** All photos currently highlighted in the grid. */
export const selectedPhotoIdsAtom = atom(new Set<string>())
/** Non-null while the full-size single-photo viewer is open. */
export const previewPhotoIdAtom = atom<string | null>(null)

export interface DeleteConfirmRequest {
  folderPath: string
  photos: Photo[]
  /** The photos the user still wants deleted, or null if they cancelled. */
  resolve: (photos: Photo[] | null) => void
}

/**
 * Non-null while the bulk-delete confirmation (see DeleteConfirmDialog) is open.
 * A single photo is confirmed with the native dialog instead.
 */
export const deleteConfirmRequestAtom = atom<DeleteConfirmRequest | null>(null)

export const filteredPhotosAtom = atom((get) => {
  const photos = get(photosAtom)
  const filter = get(ratingFilterAtom)
  return filterPhotosByRating(photos, filter)
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

/** The info sidebar only shows details for a single-photo selection. */
export const selectedPhotoAtom = atom((get) => {
  const ids = get(selectedPhotoIdsAtom)
  if (ids.size !== 1)
    return null
  const [id] = ids
  return get(filteredPhotosAtom).find(p => p.id === id) ?? null
})

export const previewPhotoAtom = atom((get) => {
  const id = get(previewPhotoIdAtom)
  if (!id)
    return null
  return get(filteredPhotosAtom).find(p => p.id === id) ?? null
})

export const setPhotoRatingAtom = atom(null, (get, set, photoId: string, rating: number) => {
  const photos = get(photosAtom)
  set(
    photosAtom,
    photos.map(p => (p.id === photoId ? { ...p, rating } : p)),
  )
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
    if (get(previewPhotoIdAtom) === photoId)
      set(previewPhotoIdAtom, newPath)
  },
)

export const removePhotosAtom = atom(null, (get, set, photoIds: string[]) => {
  const ids = new Set(photoIds)
  set(
    photosAtom,
    get(photosAtom).filter(p => !ids.has(p.id)),
  )
  set(selectedPhotoIdsAtom, (prev) => {
    if (![...prev].some(id => ids.has(id)))
      return prev
    const next = new Set(prev)
    ids.forEach(id => next.delete(id))
    return next
  })
  const anchorId = get(selectedPhotoIdAtom)
  if (anchorId && ids.has(anchorId))
    set(selectedPhotoIdAtom, null)
  const previewId = get(previewPhotoIdAtom)
  if (previewId && ids.has(previewId))
    set(previewPhotoIdAtom, null)
})
