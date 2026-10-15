import type { Photo } from '~/types/photo'
import { useSetAtom } from 'jotai'

import { useCallback } from 'react'
import { setPhotoRatingAtom } from '~/atoms/gallery'
import { setRating } from '~/lib/backend'

/** Rates one or more photos. */
export function useRatePhoto(folderPath: string | null) {
  const setPhotoRating = useSetAtom(setPhotoRatingAtom)

  return useCallback(
    (photos: Photo[], rating: number) => {
      if (!folderPath || photos.length === 0)
        return
      // Optimistic update: reflect the new rating immediately, persist in
      // the background. Ratings are cheap sqlite writes so failures are
      // rare, but we don't want a slow disk to make the star click feel
      // laggy.
      setPhotoRating(photos.map(p => p.id), rating)
      for (const photo of photos)
        void setRating(folderPath, photo.path, rating)
    },
    [folderPath, setPhotoRating],
  )
}
