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
