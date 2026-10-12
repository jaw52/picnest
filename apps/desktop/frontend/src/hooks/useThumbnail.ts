import { useEffect, useState } from 'react'

import { ensureThumbnailUrl, THUMBNAIL_CANCELLED } from '~/lib/backend'

/**
 * Module-level cache: once a thumbnail URL is resolved for a path we never
 * need to ask the backend again for the lifetime of the app, even if the masonry
 * grid unmounts/remounts the item while scrolling past it repeatedly.
 */
export const thumbnailCache = new Map<string, string>()

export function thumbnailCacheKey(folderPath: string | null, filePath: string, maxEdge: number) {
  return `${folderPath ?? ''}:${filePath}:${maxEdge}`
}

/**
 * Pixels to request for a tile rendered `width` CSS px wide on this display,
 * bucketed to powers of two so dragging the slider doesn't regenerate every
 * step.
 */
export function thumbnailEdgeFor(width: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(width * window.devicePixelRatio, 480)))
}

export function useThumbnail(
  folderPath: string | null,
  filePath: string,
  maxEdge: number,
  enabled = true,
): string | undefined {
  const cacheKey = thumbnailCacheKey(folderPath, filePath, maxEdge)
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
        const resolved = await ensureThumbnailUrl(folderPath, filePath, maxEdge, { signal: controller.signal })
        // Cache even if unmounted meanwhile: the request already ran to
        // completion, so the next mount can reuse it.
        thumbnailCache.set(cacheKey, resolved)
        if (!controller.signal.aborted)
          setFetchedUrl(resolved)
      }
      catch (error) {
        if (error === THUMBNAIL_CANCELLED)
          return
        // Expected for e.g. undownloaded iCloud placeholders; the UI
        // already renders a distinct tile for those via isCloudPlaceholder.
        console.warn(`thumbnail failed for ${filePath}:`, error)
      }
    }
    load()

    return () => controller.abort()
  }, [folderPath, filePath, maxEdge, cacheKey, enabled])

  return cachedUrl ?? fetchedUrl
}
