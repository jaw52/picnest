import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import type { Photo } from '~/types/photo'

import {
  closePreviewAtom,
  photosAtom,
  previewPhotoAtom,
  previewPhotoIdAtom,
  previewPhotosAtom,
  ratingFilterAtom,
  revealPhotoAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  setPhotoRatingAtom,
} from './gallery'

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

/** A store showing only the unrated photos a, b and c. */
function unratedStore() {
  const store = createStore()
  store.set(photosAtom, [photo('a'), photo('b'), photo('c')])
  store.set(ratingFilterAtom, 0)
  return store
}

describe('rating out of the filter', () => {
  it('moves the selection on to the next photo still shown', () => {
    const store = unratedStore()
    store.set(selectedPhotoIdsAtom, new Set(['a']))
    store.set(selectedPhotoIdAtom, 'a')

    store.set(setPhotoRatingAtom, ['a'], 3)

    expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set(['b']))
    expect(store.get(selectedPhotoIdAtom)).toBe('b')
    expect(store.get(revealPhotoAtom)).toEqual({ id: 'b' })
  })

  it('keeps the selection when the rating still matches the filter', () => {
    const store = unratedStore()
    store.set(ratingFilterAtom, null)
    store.set(selectedPhotoIdsAtom, new Set(['a']))

    store.set(setPhotoRatingAtom, ['a'], 4)

    expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set(['a']))
  })

  it('keeps the viewer on the photo, paging through the photos it opened with', () => {
    const store = unratedStore()
    store.set(previewPhotoIdAtom, 'b')

    store.set(setPhotoRatingAtom, ['b'], 5)

    expect(store.get(previewPhotoAtom)?.rating).toBe(5)
    expect(store.get(previewPhotosAtom).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('closing the viewer', () => {
  it('selects the photo it showed', () => {
    const store = unratedStore()
    store.set(previewPhotoIdAtom, 'c')

    store.set(closePreviewAtom)

    expect(store.get(previewPhotoIdAtom)).toBeNull()
    expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set(['c']))
    expect(store.get(revealPhotoAtom)).toEqual({ id: 'c' })
  })

  it('selects the next photo in the grid when the one shown was rated out of it', () => {
    const store = unratedStore()
    store.set(previewPhotoIdAtom, 'b')
    store.set(setPhotoRatingAtom, ['b'], 3)

    store.set(closePreviewAtom)

    expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set(['c']))
  })
})
