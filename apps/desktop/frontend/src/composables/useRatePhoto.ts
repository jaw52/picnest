import type { MaybeRefOrGetter } from 'vue'
import type { Photo } from '~/types/photo'
import { toValue } from 'vue'
import { setRating } from '~/lib/backend'
import { useGallery } from '~/state/gallery'

/** Rates one or more photos. */
export function useRatePhoto(folderPath: MaybeRefOrGetter<string | null>): (photos: Photo[], rating: number) => void {
  const gallery = useGallery()

  return (photos, rating) => {
    const folder = toValue(folderPath)
    if (!folder || photos.length === 0)
      return
    // Optimistic update: reflect the new rating immediately, persist in
    // the background. Ratings are cheap sqlite writes so failures are
    // rare, but we don't want a slow disk to make the star click feel
    // laggy.
    gallery.setPhotoRating(photos.map(p => p.id), rating)
    for (const photo of photos)
      void setRating(folder, photo.path, rating)
  }
}
