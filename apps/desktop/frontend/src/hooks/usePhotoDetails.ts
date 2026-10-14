import type { PhotoDetails } from '~/types/photo'

import { useEffect, useState } from 'react'
import { getPhotoDetails } from '~/lib/backend'

// Module-level cache: EXIF/file-size never changes for the lifetime of the
// app, so once we've read it for a path there's no need to ask the backend again
// just because the info card closed and opened again.
const detailsCache = new Map<string, PhotoDetails>()

export function usePhotoDetails(path: string | null): {
  details: PhotoDetails | null
  loading: boolean
} {
  const cachedDetails = path ? (detailsCache.get(path) ?? null) : null

  // Adjusts state during render when the path changes, rather than in an
  // effect - this is the "in-flight fetch" result, which only matters
  // until the cache (an external store) has it.
  const [prevPath, setPrevPath] = useState(path)
  const [fetchedDetails, setFetchedDetails] = useState<PhotoDetails | null>(null)
  const [loading, setLoading] = useState(false)
  if (path !== prevPath) {
    setPrevPath(path)
    setFetchedDetails(null)
    setLoading(!!path && !cachedDetails)
  }

  useEffect(() => {
    if (!path || detailsCache.has(path))
      return

    let cancelled = false
    async function load() {
      try {
        // path is narrowed above, but TS can't see that across the async
        // boundary without re-checking it here.
        if (!path)
          return
        const resolved = await getPhotoDetails(path)
        if (cancelled)
          return
        detailsCache.set(path, resolved)
        setFetchedDetails(resolved)
      }
      catch (error) {
        console.warn(`failed to read photo details for ${path}:`, error)
      }
      finally {
        if (!cancelled)
          setLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [path])

  return { details: cachedDetails ?? fetchedDetails, loading }
}
