import type { Photo } from '~/types/photo'
import { useEffect, useSyncExternalStore } from 'react'

import { libraryFileNames } from '~/lib/backend'
import { isLibraryPath } from '~/lib/library'

/**
 * Names of photos in the Photos library, by path. Scans leave them out, as
 * reading them is slow (about 1.5ms a photo), so they are read for the
 * photos shown, as they show.
 */
const names = new Map<string, string>()
const listeners = new Set<() => void>()
const queued = new Set<string>()
const asked = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** Asks for the names of every photo queued during one render together. */
async function flush() {
  flushTimer = undefined
  const paths = [...queued]
  queued.clear()
  try {
    const found = await libraryFileNames(paths)
    for (const [path, name] of Object.entries(found))
      names.set(path, name)
    for (const listener of listeners)
      listener()
  }
  catch (error) {
    // Asked again the next time one shows.
    for (const path of paths)
      asked.delete(path)
    console.warn('failed to read photo names:', error)
  }
}

/** Queues path's name to be read with the others asked for in the same render. */
function requestName(path: string) {
  if (names.has(path) || asked.has(path))
    return
  asked.add(path)
  queued.add(path)
  flushTimer ??= setTimeout(() => void flush())
}

function needsName(photo: Photo | null): boolean {
  return photo !== null && photo.fileName === '' && isLibraryPath(photo.path)
}

/** The photo's file name, read when first shown for a library photo; '' meanwhile. */
export function useFileName(photo: Photo | null): string {
  const lazy = needsName(photo)
  const path = photo?.path ?? ''
  const name = useSyncExternalStore(subscribe, () => (lazy ? names.get(path) : undefined))
  useEffect(() => {
    if (lazy)
      requestName(path)
  }, [lazy, path])
  return lazy ? name ?? '' : photo?.fileName ?? ''
}
