import type { Photo } from '~/types/photo'
import { describe, expect, it } from 'vitest'
import { createGallery } from './gallery'

function photo(id: string, rating = 0): Photo {
  return {
    id,
    path: id,
    fileName: id,
    width: 100,
    height: 100,
    rating,
    modified: 0,
    taken: 0,
    isCloudPlaceholder: false,
    aspectRatio: 1,
  }
}

/** A gallery showing only the unrated photos a, b and c. */
function unratedGallery() {
  const gallery = createGallery()
  gallery.photos.value = [photo('a'), photo('b'), photo('c')]
  gallery.ratingFilter.value = 0
  return gallery
}

describe('rating out of the filter', () => {
  it('moves the selection on to the next photo still shown', () => {
    const gallery = unratedGallery()
    gallery.selectedPhotoIds.value = new Set(['a'])
    gallery.selectedPhotoId.value = 'a'

    gallery.setPhotoRating(['a'], 3)

    expect(gallery.selectedPhotoIds.value).toEqual(new Set(['b']))
    expect(gallery.selectedPhotoId.value).toBe('b')
    expect(gallery.revealPhoto.value).toEqual({ id: 'b' })
  })

  it('keeps the selection when the rating still matches the filter', () => {
    const gallery = unratedGallery()
    gallery.ratingFilter.value = null
    gallery.selectedPhotoIds.value = new Set(['a'])

    gallery.setPhotoRating(['a'], 4)

    expect(gallery.selectedPhotoIds.value).toEqual(new Set(['a']))
  })

  it('keeps the viewer on the photo, paging through the photos it opened with', () => {
    const gallery = unratedGallery()
    gallery.setPreviewPhotoId('b')

    gallery.setPhotoRating(['b'], 5)

    expect(gallery.previewPhoto.value?.rating).toBe(5)
    expect(gallery.previewPhotos.value.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('closing the viewer', () => {
  it('selects the photo it showed', () => {
    const gallery = unratedGallery()
    gallery.setPreviewPhotoId('c')

    gallery.closePreview()

    expect(gallery.previewPhotoId.value).toBeNull()
    expect(gallery.selectedPhotoIds.value).toEqual(new Set(['c']))
    expect(gallery.revealPhoto.value).toEqual({ id: 'c' })
  })

  it('selects the next photo in the grid when the one shown was rated out of it', () => {
    const gallery = unratedGallery()
    gallery.setPreviewPhotoId('b')
    gallery.setPhotoRating(['b'], 3)

    gallery.closePreview()

    expect(gallery.selectedPhotoIds.value).toEqual(new Set(['c']))
  })
})
