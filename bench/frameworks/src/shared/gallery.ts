// Framework-free rules of the gallery, shared so each app only differs in
// how it holds state and renders.

import type { Photo } from './types.ts'

/** Rating filter buttons: 0 shows every photo, n shows those rated n or more. */
export const FILTERS = [0, 1, 2, 3, 4, 5] as const
export const STARS = [1, 2, 3, 4, 5] as const
export const DEFAULT_COLUMN_WIDTH = 240
export const MIN_COLUMN_WIDTH = 120
export const MAX_COLUMN_WIDTH = 400

/**
 * The photos rated `filter` or more (all of them for 0). A rating changed
 * in the app lives apart from the photo, as an override by id: loading
 * thousands of photos then writes nothing reactive, and rating one changes
 * one value rather than the list.
 */
export function filterPhotos(photos: readonly Photo[], filter: number, ratingOf: (photo: Photo) => number): Photo[] {
  return filter === 0 ? photos as Photo[] : photos.filter(p => ratingOf(p) >= filter)
}

/** The photo the preview moves to once the one at `index` is deleted: the next, else the previous. */
export function idAfterDelete(photos: readonly Photo[], index: number): string | null {
  return photos[index + 1]?.id ?? photos[index - 1]?.id ?? null
}

/** CSS width of the preview's frame: as large as fits, keeping the photo's shape. */
export function frameWidth(aspectRatio: number) {
  return `min(calc(100vw - 96px), calc((100vh - 168px) * ${aspectRatio}))`
}

/** Full-size images the preview keeps decoded around the photo at `index`. */
export function decodeWindow(photos: readonly Photo[], index: number): string[] {
  return [index - 1, index, index + 1, index + 2].map(i => photos[i]?.full).filter((src): src is string => !!src)
}

/** Where the filmstrip scrolls so thumbnail `index` sits in its middle. */
export function filmScrollFor(index: number, filmStep: number) {
  return index * filmStep + 24
}

/** Flat color standing in for an image when images are off. */
export function flatColor(photo: Photo) {
  return `hsl(${photo.hue} 45% 62%)`
}
