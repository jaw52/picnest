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

/** What the grid groups photos by when they were taken; `null` for not at all. */
export type PhotoGrouping = 'year' | 'month' | 'day' | null

/** A run of photos taken in the same year, month or day. */
export interface PhotoGroup {
  /** When the period starts, in local time, as milliseconds since the epoch. */
  start: number
  photos: Photo[]
}

/** The newest first; photos taken at the same time keep their order. */
export function sortByTaken(photos: readonly Photo[]): Photo[] {
  return photos.toSorted((a, b) => b.taken - a.taken)
}

/** The start of the period `taken` (Unix seconds) falls in, in local time. */
function periodStart(taken: number, grouping: NonNullable<PhotoGrouping>): number {
  const date = new Date(taken * 1000)
  return new Date(
    date.getFullYear(),
    grouping === 'year' ? 0 : date.getMonth(),
    grouping === 'day' ? date.getDate() : 1,
  ).getTime()
}

/** Splits `photos`, in their order, into runs taken in the same period. */
export function groupPhotos(photos: readonly Photo[], grouping: NonNullable<PhotoGrouping>): PhotoGroup[] {
  const groups: PhotoGroup[] = []
  for (const photo of photos) {
    const start = periodStart(photo.taken, grouping)
    const last = groups.at(-1)
    if (last?.start === start)
      last.photos.push(photo)
    else
      groups.push({ start, photos: [photo] })
  }
  return groups
}
