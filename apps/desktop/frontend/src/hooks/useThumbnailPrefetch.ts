import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'

import { prefetchPathsAtom, thumbnailProgressAtom, unloadedPhotosAtom } from '~/atoms/gallery'
import { ensureThumbnailUrl } from '~/lib/backend'
import { cacheThumbnail, thumbnailCache, thumbnailCacheKey } from './useThumbnail'

const CONCURRENCY = 4

/**
 * Warms the thumbnail cache for the whole folder (regardless of the rating
 * filter) in the background, so
 * scrolling a freshly opened large folder mostly hits ready thumbnails.
 * Requests are marked `background`, so tiles actually on screen (which ask
 * for their own thumbnail) are always served first by the backend.
 *
 * Progress counts every photo in the folder: ready ones (cached, by an
 * earlier run or by a tile on screen) are done, and photos in pages not yet
 * loaded are still to do. A new page restarts the run, which counts what is
 * cached afresh, so progress never steps back.
 */
export function useThumbnailPrefetch(folderPath: string | null, maxEdge: number) {
  const paths = useAtomValue(prefetchPathsAtom)
  const unloaded = useAtomValue(unloadedPhotosAtom)
  const setProgress = useSetAtom(thumbnailProgressAtom)

  useEffect(() => {
    if (!folderPath || maxEdge <= 0)
      return

    const queue = paths.filter(path => !thumbnailCache.has(thumbnailCacheKey(folderPath, path, maxEdge)))
    const total = paths.length + unloaded
    let done = paths.length - queue.length
    const report = () => setProgress(done >= total ? { total: 0, done: 0 } : { total, done })
    report()

    const controller = new AbortController()
    let next = 0

    async function worker() {
      while (!controller.signal.aborted && next < queue.length) {
        const path = queue[next++]
        const key = thumbnailCacheKey(folderPath, path, maxEdge)
        try {
          if (!thumbnailCache.has(key))
            cacheThumbnail(folderPath, path, maxEdge, false, await ensureThumbnailUrl(folderPath!, path, maxEdge, { background: true, signal: controller.signal }))
        }
        catch {
          // Per-tile failures surface when that tile mounts.
        }
        // The next run (or none, for a closed folder) reports from here.
        if (controller.signal.aborted)
          return
        done++
        report()
      }
    }
    for (let i = 0; i < CONCURRENCY; i++)
      void worker()

    return () => {
      controller.abort()
      setProgress({ total: 0, done: 0 })
    }
  }, [paths, unloaded, folderPath, maxEdge, setProgress])
}
