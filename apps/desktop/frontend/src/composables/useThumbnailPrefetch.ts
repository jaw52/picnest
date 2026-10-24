import type { MaybeRefOrGetter } from 'vue'
import { toValue, watch } from 'vue'
import { useTabActive } from '~/context/tab'
import { ensureThumbnailUrl } from '~/lib/backend'
import { useGallery } from '~/state/gallery'
import { cacheThumbnail, hasCachedThumbnail, thumbnailCacheKey } from './useThumbnail'

const CONCURRENCY = 4

/**
 * Warms the thumbnail cache for the whole folder (regardless of the rating
 * filter) in the background, so
 * scrolling a freshly opened large folder mostly hits ready thumbnails.
 * Requests are marked `background`, so tiles actually on screen (which ask
 * for their own thumbnail) are always served first by the backend. Only the
 * tab shown prefetches.
 *
 * Progress counts every photo in the folder: ready ones (cached, by an
 * earlier run or by a tile on screen) are done, and photos in pages not yet
 * loaded are still to do. A new page restarts the run, which counts what is
 * cached afresh, so progress never steps back.
 */
export function useThumbnailPrefetch(folderPath: MaybeRefOrGetter<string | null>, maxEdge: MaybeRefOrGetter<number>): void {
  const { prefetchPaths, unloadedPhotos, thumbnailProgress } = useGallery()
  const active = useTabActive()

  watch(
    () => [prefetchPaths.value, unloadedPhotos.value, toValue(folderPath), toValue(maxEdge), active.value] as const,
    ([paths, unloaded, folder, edge, shown], _, onCleanup) => {
      if (!folder || edge <= 0 || !shown)
        return

      const queue = paths.filter(path => !hasCachedThumbnail(thumbnailCacheKey(folder, path, edge)))
      const total = paths.length + unloaded
      let done = paths.length - queue.length
      const report = () => {
        thumbnailProgress.value = done >= total ? { total: 0, done: 0 } : { total, done }
      }
      report()

      const controller = new AbortController()
      onCleanup(() => {
        controller.abort()
        thumbnailProgress.value = { total: 0, done: 0 }
      })
      let next = 0

      async function worker() {
        while (!controller.signal.aborted && next < queue.length) {
          const path = queue[next++]
          try {
            if (!hasCachedThumbnail(thumbnailCacheKey(folder, path, edge)))
              cacheThumbnail(folder, path, edge, false, await ensureThumbnailUrl(folder!, path, edge, { background: true, signal: controller.signal }))
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
    },
    { immediate: true },
  )
}
