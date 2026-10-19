import { useEffect, useState } from 'react'

import { ensureThumbnailUrl, THUMBNAIL_CANCELLED } from '~/lib/backend'

/**
 * Module-level cache: once a thumbnail URL is resolved for a path we never
 * need to ask the backend again for the lifetime of the app, even if the masonry
 * grid unmounts/remounts the item while scrolling past it repeatedly.
 */
export const thumbnailCache = new Map<string, string>()

/** Each photo's largest thumbnail in thumbnailCache, by `folderPath:filePath`. */
const largestThumbnails = new Map<string, { edge: number, url: string }>()

/**
 * `cloud` marks an undownloaded iCloud file, whose thumbnail comes from
 * iCloud and is replaced by a decoded one once the file is downloaded.
 */
export function thumbnailCacheKey(folderPath: string | null, filePath: string, maxEdge: number, cloud = false) {
  return `${folderPath ?? ''}:${filePath}:${maxEdge}${cloud ? ':cloud' : ''}`
}

/** Adds a resolved thumbnail to thumbnailCache. */
export function cacheThumbnail(folderPath: string | null, filePath: string, maxEdge: number, cloud: boolean, url: string) {
  thumbnailCache.set(thumbnailCacheKey(folderPath, filePath, maxEdge, cloud), url)
  const photoKey = `${folderPath ?? ''}:${filePath}`
  const largest = largestThumbnails.get(photoKey)
  if (!largest || maxEdge >= largest.edge)
    largestThumbnails.set(photoKey, { edge: maxEdge, url })
}

/** Forgets every resolved thumbnail, once their files are deleted. */
export function clearThumbnailCache() {
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
export function thumbnailEdgeFor(width: number) {
  const pixels = Math.max(width * window.devicePixelRatio, 480)
  return Math.ceil(pixels / THUMBNAIL_EDGE_STEP) * THUMBNAIL_EDGE_STEP
}

/**
 * `background` asks behind the requests that aren't, for a picture not on
 * screen yet; turning it off asks again, at the front.
 */
export function useThumbnail(
  folderPath: string | null,
  filePath: string,
  maxEdge: number,
  enabled = true,
  cloud = false,
  background = false,
): string | undefined {
  const cacheKey = thumbnailCacheKey(folderPath, filePath, maxEdge, cloud)
  const cachedUrl = thumbnailCache.get(cacheKey)

  // Adjusts state during render when the key changes, rather than in an
  // effect - this is the "in-flight fetch" result, which only matters
  // until the cache (an external store) has it.
  const [prevCacheKey, setPrevCacheKey] = useState(cacheKey)
  const [fetchedUrl, setFetchedUrl] = useState<string | undefined>(undefined)
  if (cacheKey !== prevCacheKey) {
    setPrevCacheKey(cacheKey)
    setFetchedUrl(undefined)
  }

  useEffect(() => {
    if (!folderPath || !enabled || thumbnailCache.has(cacheKey))
      return

    // Aborting on unmount drops the request from the backend queue, so tiles
    // scrolled past don't hold up the ones on screen.
    const controller = new AbortController()

    async function load() {
      try {
        // folderPath is narrowed above, but TS can't see that across the
        // async boundary without re-checking it here.
        if (!folderPath)
          return
        const resolved = await ensureThumbnailUrl(folderPath, filePath, maxEdge, { background, signal: controller.signal })
        // Cache even if unmounted meanwhile: the request already ran to
        // completion, so the next mount can reuse it.
        cacheThumbnail(folderPath, filePath, maxEdge, cloud, resolved)
        if (!controller.signal.aborted)
          setFetchedUrl(resolved)
      }
      catch (error) {
        if (error === THUMBNAIL_CANCELLED)
          return
        // Expected for e.g. an undownloaded iCloud file iCloud has no
        // thumbnail of; the UI renders a distinct tile for those.
        console.warn(`thumbnail failed for ${filePath}:`, error)
      }
    }
    void load()

    return () => controller.abort()
  }, [folderPath, filePath, maxEdge, cacheKey, enabled, cloud, background])

  return cachedUrl ?? fetchedUrl
}
