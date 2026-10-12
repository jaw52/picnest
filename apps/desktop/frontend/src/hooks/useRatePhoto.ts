import type { Photo } from '~/types/photo'
import { useSetAtom } from 'jotai'

import { useCallback } from 'react'
import { setPhotoRatingAtom } from '~/atoms/gallery'
import { setRating } from '~/lib/backend'

export function useRatePhoto(folderPath: string | null) {
  const setPhotoRating = useSetAtom(setPhotoRatingAtom)

  return useCallback(
    (photo: Photo, rating: number) => {
      if (!folderPath)
        return
      // Optimistic update: reflect the new rating immediately, persist in
      // the background. Ratings are cheap sqlite writes so failures are
      // rare, but we don't want a slow disk to make the star click feel
      // laggy.
      setPhotoRating(photo.id, rating)
      void setRating(folderPath, photo.fileName, rating)
    },
    [folderPath, setPhotoRating],
  )
}
