import type { Photo, PhotoMeta } from '~/types/photo'

import { describe, expect, it } from 'vitest'

import { filterPhotosByRating, matchesRatingFilter, ratingCounts, successorOf, toPhoto } from './photo'

function photo(overrides: Partial<Photo> = {}): Photo {
  return {
    aspectRatio: 1,
    fileName: 'a.jpg',
    height: 100,
    id: '/a.jpg',
    isCloudPlaceholder: false,
    modified: 0,
    path: '/a.jpg',
    rating: 0,
    width: 100,
    ...overrides,
  }
}

describe('toPhoto', () => {
  it('derives id from path and aspectRatio from width/height', () => {
    const meta: PhotoMeta = {
      fileName: 'y.jpg',
      height: 400,
      isCloudPlaceholder: false,
      modified: 123,
      path: '/x/y.jpg',
      rating: 3,
      width: 800,
    }
    const result = toPhoto(meta)
    expect(result.id).toBe('/x/y.jpg')
    expect(result.aspectRatio).toBe(2)
    expect(result.rating).toBe(3)
  })

  it('falls back to aspectRatio 1 when height is 0 to avoid dividing by zero', () => {
    const meta: PhotoMeta = {
      fileName: 'broken.jpg',
      height: 0,
      isCloudPlaceholder: false,
      modified: 0,
      path: '/x/broken.jpg',
      rating: 0,
      width: 800,
    }
    expect(toPhoto(meta).aspectRatio).toBe(1)
  })
})

describe('matchesRatingFilter', () => {
  it('matches everything when filter is null', () => {
    expect(matchesRatingFilter(photo({ rating: 0 }), null)).toBe(true)
    expect(matchesRatingFilter(photo({ rating: 5 }), null)).toBe(true)
  })

  it('filter 0 matches only unrated photos', () => {
    expect(matchesRatingFilter(photo({ rating: 0 }), 0)).toBe(true)
    expect(matchesRatingFilter(photo({ rating: 1 }), 0)).toBe(false)
  })

  it('filter N matches only photos rated exactly N', () => {
    expect(matchesRatingFilter(photo({ rating: 3 }), 3)).toBe(true)
    expect(matchesRatingFilter(photo({ rating: 4 }), 3)).toBe(false)
  })
})

describe('filterPhotosByRating', () => {
  const photos = [
    photo({ id: '1', rating: 0 }),
    photo({ id: '2', rating: 3 }),
    photo({ id: '3', rating: 3 }),
    photo({ id: '4', rating: 5 }),
  ]

  it('returns all photos when filter is null', () => {
    expect(filterPhotosByRating(photos, null)).toHaveLength(4)
  })

  it('returns only photos matching the given rating', () => {
    const result = filterPhotosByRating(photos, 3)
    expect(result.map(p => p.id)).toEqual(['2', '3'])
  })

  it('returns empty array when nothing matches', () => {
    expect(filterPhotosByRating(photos, 2)).toEqual([])
  })
})

describe('ratingCounts', () => {
  it('counts photos per rating bucket, including zero for missing buckets', () => {
    const photos = [
      photo({ rating: 0 }),
      photo({ rating: 0 }),
      photo({ rating: 5 }),
      photo({ rating: 3 }),
    ]
    expect(ratingCounts(photos)).toEqual({
      0: 2,
      1: 0,
      2: 0,
      3: 1,
      4: 0,
      5: 1,
    })
  })

  it('returns all-zero buckets for an empty list', () => {
    expect(ratingCounts([])).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
  })
})

describe('successorOf', () => {
  const photos = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id }))
  const ids = (...list: string[]) => new Set(list)

  it('picks the first photo after the removed ones', () => {
    expect(successorOf(photos, ids('b'))?.id).toBe('c')
    expect(successorOf(photos, ids('b', 'c'))?.id).toBe('d')
    expect(successorOf(photos, ids('a', 'c'))?.id).toBe('d')
  })

  it('falls back to the last one before them at the end of the list', () => {
    expect(successorOf(photos, ids('e'))?.id).toBe('d')
    expect(successorOf(photos, ids('b', 'd', 'e'))?.id).toBe('c')
  })

  it('is undefined when nothing is left or nothing was removed', () => {
    expect(successorOf(photos, ids('a', 'b', 'c', 'd', 'e'))).toBeUndefined()
    expect(successorOf(photos, ids('z'))).toBeUndefined()
  })
})
