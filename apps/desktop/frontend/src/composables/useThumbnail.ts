import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, reactive, toRaw, toValue, watch } from 'vue'
import { ensureThumbnailUrl, THUMBNAIL_CANCELLED } from '~/lib/backend'

/**
 * Module-level cache: once a thumbnail URL is resolved for a path we never
 * need to ask the backend again for the lifetime of the app, even if the masonry
 * grid unmounts/remounts the item while scrolling past it repeatedly.
 * Reactive per key, so a thumbnail landing updates only the tiles showing it.
 */
const thumbnailCache = reactive(new Map<string, string>())

/** Each photo's largest thumbnail in thumbnailCache, by `folderPath:filePath`. */
const largestThumbnails = new Map<string, { edge: number, url: string }>()

/**
 * `cloud` marks an undownloaded iCloud file, whose thumbnail comes from
 * iCloud and is replaced by a decoded one once the file is downloaded.
 */
export function thumbnailCacheKey(folderPath: string | null, filePath: string, maxEdge: number, cloud = false): string {
  return `${folderPath ?? ''}:${filePath}:${maxEdge}${cloud ? ':cloud' : ''}`
}

/** Whether a thumbnail is resolved, without making the caller depend on it. */
export function hasCachedThumbnail(key: string): boolean {
  return toRaw(thumbnailCache).has(key)
}

/** Adds a resolved thumbnail to thumbnailCache. */
export function cacheThumbnail(folderPath: string | null, filePath: string, maxEdge: number, cloud: boolean, url: string): void {
  thumbnailCache.set(thumbnailCacheKey(folderPath, filePath, maxEdge, cloud), url)
  const photoKey = `${folderPath ?? ''}:${filePath}`
  const largest = largestThumbnails.get(photoKey)
  if (!largest || maxEdge >= largest.edge)
    largestThumbnails.set(photoKey, { edge: maxEdge, url })
}

/** Forgets every resolved thumbnail, once their files are deleted. */
export function clearThumbnailCache(): void {
  thumbnailCache.clear()
  largestThumbnails.clear()
}

/**
 * The largest thumbnail of a photo already resolved at any size, to stand in
 * for the photo while it loads; undefined if none is.
 */
export function largestCachedThumbnail(folderPath: string | null, filePath: string): string | undefined {
  return largestThumbnails.get(`${folderPath ?? ''}:${filePath}`)?.url
}

/** Steps thumbnail sizes go up in; see thumbnailEdgeFor. */
const THUMBNAIL_EDGE_STEP = 256

/**
 * Pixels to request for a tile rendered `width` CSS px wide on this display,
 * rounded up to a THUMBNAIL_EDGE_STEP: fine enough that a tile's thumbnail
 * is never much larger than it shows, coarse enough that resizing the
 * window or the tiles crosses a step only now and then. A thumbnail
 * generated at another step stands in meanwhile (see largestCachedThumbnail).
 */
export function thumbnailEdgeFor(width: number): number {
  const pixels = Math.max(width * window.devicePixelRatio, 480)
  return Math.ceil(pixels / THUMBNAIL_EDGE_STEP) * THUMBNAIL_EDGE_STEP
}

export interface ThumbnailOptions {
  enabled?: MaybeRefOrGetter<boolean>
  /** An undownloaded iCloud file, shown from iCloud's own thumbnail. */
  cloud?: MaybeRefOrGetter<boolean>
  /**
   * Asks behind the requests that aren't, for a picture not on screen yet;
   * turning it off asks again, at the front.
   */
  background?: MaybeRefOrGetter<boolean>
}

export function useThumbnail(
  folderPath: MaybeRefOrGetter<string | null>,
  filePath: MaybeRefOrGetter<string>,
  maxEdge: MaybeRefOrGetter<number>,
  options: ThumbnailOptions = {},
): ComputedRef<string | undefined> {
  const cacheKey = computed(() =>
    thumbnailCacheKey(toValue(folderPath), toValue(filePath), toValue(maxEdge), toValue(options.cloud) ?? false))

  watch(
    () => [cacheKey.value, toValue(options.enabled) ?? true, toValue(options.background) ?? false] as const,
    ([key, enabled, background], _, onCleanup) => {
      const folder = toValue(folderPath)
      if (!folder || !enabled || hasCachedThumbnail(key))
        return
      const file = toValue(filePath)
      const edge = toValue(maxEdge)
      const cloud = toValue(options.cloud) ?? false

      // Aborting on unmount drops the request from the backend queue, so tiles
      // scrolled past don't hold up the ones on screen.
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      ensureThumbnailUrl(folder, file, edge, { background, signal: controller.signal })
        // Cached even if unmounted meanwhile: the request already ran to
        // completion, so the next mount can reuse it.
        .then(resolved => cacheThumbnail(folder, file, edge, cloud, resolved))
        .catch((error: unknown) => {
          if (error === THUMBNAIL_CANCELLED)
            return
          // Expected for e.g. an undownloaded iCloud file iCloud has no
          // thumbnail of; the UI renders a distinct tile for those.
          console.warn(`thumbnail failed for ${file}:`, error)
        })
    },
    { immediate: true },
  )

  return computed(() => thumbnailCache.get(cacheKey.value))
}
