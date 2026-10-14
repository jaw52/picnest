import type { Photo, PhotoMeta } from '~/types/photo'

export function toPhoto(meta: PhotoMeta): Photo {
  return {
    ...meta,
    id: meta.path,
    aspectRatio: meta.height > 0 ? meta.width / meta.height : 1,
  }
}

/** `null` means "no filter" (show everything, rated or not). */
export type RatingFilter = number | null

export function matchesRatingFilter(photo: Pick<Photo, 'rating'>, filter: RatingFilter): boolean {
  if (filter === null)
    return true
  if (filter === 0)
    return photo.rating === 0
  return photo.rating === filter
}

export function filterPhotosByRating(photos: Photo[], filter: RatingFilter): Photo[] {
  return photos.filter(p => matchesRatingFilter(p, filter))
}

export function ratingCounts(photos: Pick<Photo, 'rating'>[]): Record<number, number> {
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const p of photos) {
    counts[p.rating] = (counts[p.rating] ?? 0) + 1
  }
  return counts
}

/**
 * What to select once the photos in `removed` leave `photos` (deleted, or
 * rated out of the filter): the first one after them, else the last before.
 */
export function successorOf<T extends { id: string }>(
  photos: readonly T[],
  removed: ReadonlySet<string>,
): T | undefined {
  const last = photos.findLastIndex(p => removed.has(p.id))
  if (last === -1)
    return undefined
  return photos.slice(last + 1).find(p => !removed.has(p.id))
    ?? photos.slice(0, last).findLast(p => !removed.has(p.id))
}
