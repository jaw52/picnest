import type { Photo } from './types.ts'

/** How many distinct source images scripts/gen-images.ts writes. */
export const IMAGE_COUNT = 48

/** Width over height of source image `k`, between 0.6 (portrait) and 1.8 (panorama). */
export function imageAspectRatio(k: number): number {
  const ratios = [0.6, 0.67, 0.75, 0.8, 1, 1.25, 1.33, 1.5, 1.78]
  return ratios[(k * 7) % ratios.length]
}

/** Width and height of each picture exported from the Photos library, and whether it has a preview. */
export interface RealImage {
  w: number
  h: number
  full: boolean
}

let realImages: RealImage[] | null = null

/**
 * Makes makePhotos use the pictures scripts/export-photos.swift exported
 * from the Photos library (served at /real/) instead of the generated ones.
 */
export function useRealImages(images: RealImage[]) {
  realImages = images
}

/** Deterministic PRNG, so every framework gets the very same photos. */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `count` photos starting at `offset`. Every photo has its own URL (the
 * query differs) so the webview fetches and decodes each, as it would with
 * a real folder.
 */
export function makePhotos(count: number, offset: number, images: boolean, seed = 1): Photo[] {
  const random = mulberry32(seed + offset)
  return Array.from({ length: count }, (_, j) => {
    const i = offset + j
    const rating = Math.floor(random() * 6)
    const hue = Math.floor(random() * 360)
    const id = `p${seed}-${i}`
    const name = `IMG_${String(1000 + i).padStart(5, '0')}.jpg`
    if (realImages) {
      // Each tab (seed) its own URLs, as different folders would be.
      const k = i % realImages.length
      const real = realImages[k]
      const thumb = `/real/t/${k}.jpg?t=${seed}`
      return { id, name, aspectRatio: real.w / real.h, rating, hue, thumb, full: real.full ? `/real/f/${k}.jpg?t=${seed}` : thumb }
    }
    const k = i % IMAGE_COUNT
    return {
      id,
      name,
      aspectRatio: imageAspectRatio(k),
      rating,
      thumb: images ? `/img/t/${k}.jpg?i=${i}` : '',
      full: images ? `/img/f/${k}.jpg?i=${i}` : '',
      hue,
    }
  })
}
