import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'

import { prefetchPathsAtom, thumbnailProgressAtom } from '~/atoms/gallery'
import { ensureThumbnailUrl } from '~/lib/backend'
import { thumbnailCache, thumbnailCacheKey } from './useThumbnail'

const CONCURRENCY = 4

/**
 * Warms the thumbnail cache for the whole folder (regardless of the rating
 * filter) in the background, so
 * scrolling a freshly opened large folder mostly hits ready thumbnails.
 * Requests are marked `background`, so tiles actually on screen (which ask
 * for their own thumbnail) are always served first by the backend.
 */
export function useThumbnailPrefetch(folderPath: string | null, maxEdge: number) {
  const paths = useAtomValue(prefetchPathsAtom)
  const setProgress = useSetAtom(thumbnailProgressAtom)

  useEffect(() => {
    if (!folderPath || maxEdge <= 0)
      return

    const queue = paths.filter(path => !thumbnailCache.has(thumbnailCacheKey(folderPath, path, maxEdge)))
    if (queue.length === 0)
      return

    const controller = new AbortController()
    let next = 0
    let finished = 0
    setProgress(prev => ({ total: prev.total + queue.length, done: prev.done }))

    async function worker() {
      while (!controller.signal.aborted && next < queue.length) {
        const path = queue[next++]
        const key = thumbnailCacheKey(folderPath!, path, maxEdge)
        try {
          if (!thumbnailCache.has(key))
            thumbnailCache.set(key, await ensureThumbnailUrl(folderPath!, path, maxEdge, { background: true, signal: controller.signal }))
        }
        catch {
          // Per-tile failures surface when that tile mounts.
        }
        // The cleanup already took in-flight requests out of the total.
        if (controller.signal.aborted)
          return
        finished++
        setProgress((prev) => {
          const done = prev.done + 1
          return done >= prev.total ? { total: 0, done: 0 } : { ...prev, done }
        })
      }
    }
    for (let i = 0; i < CONCURRENCY; i++)
      void worker()

    return () => {
      controller.abort()
      // Give back the share of the total this run never completed. Queued
      // requests are dropped; ones already decoding finish into the cache
      // but no longer count.
      const unfinished = queue.length - finished
      setProgress((prev) => {
        const total = Math.max(prev.total - unfinished, 0)
        return prev.done >= total ? { total: 0, done: 0 } : { ...prev, total }
      })
    }
  }, [paths, folderPath, maxEdge, setProgress])
}
