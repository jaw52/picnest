import { afterEach, expect, it, vi } from 'vitest'

import { cacheThumbnail, largestCachedThumbnail, thumbnailEdgeFor } from './useThumbnail'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('rounds a tile up to the next 256px step, from 512px', () => {
  vi.stubGlobal('devicePixelRatio', 2)
  expect(thumbnailEdgeFor(120)).toBe(512)
  expect(thumbnailEdgeFor(240)).toBe(512)
  expect(thumbnailEdgeFor(320)).toBe(768)
  expect(thumbnailEdgeFor(384)).toBe(768)
  expect(thumbnailEdgeFor(480)).toBe(1024)
})

it('keeps the largest thumbnail of each photo to stand in for it', () => {
  expect(largestCachedThumbnail('/f', '/f/a.jpg')).toBeUndefined()
  cacheThumbnail('/f', '/f/a.jpg', 768, false, 'a-768')
  cacheThumbnail('/f', '/f/a.jpg', 512, false, 'a-512')
  cacheThumbnail('/f', '/f/b.jpg', 512, false, 'b-512')
  expect(largestCachedThumbnail('/f', '/f/a.jpg')).toBe('a-768')
  expect(largestCachedThumbnail('/f', '/f/b.jpg')).toBe('b-512')
  expect(largestCachedThumbnail('/g', '/f/a.jpg')).toBeUndefined()
})
