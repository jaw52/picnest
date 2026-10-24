import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { Photo } from '~/types/photo'
import { computed, reactive, toValue, watchEffect } from 'vue'
import { libraryFileNames } from '~/lib/backend'
import { isLibraryPath } from '~/lib/library'

/**
 * Names of photos in the Photos library, by path. Scans leave them out, as
 * reading them is slow (about 1.5ms a photo), so they are read for the
 * photos shown, as they show. Reactive per path: a name arriving updates
 * only what shows that photo.
 */
const names = reactive(new Map<string, string>())
const queued = new Set<string>()
const asked = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | undefined

/** Asks for the names of every photo queued in the same tick together. */
async function flush() {
  flushTimer = undefined
  const paths = [...queued]
  queued.clear()
  try {
    const found = await libraryFileNames(paths)
    for (const [path, name] of Object.entries(found))
      names.set(path, name)
  }
  catch (error) {
    // Asked again the next time one shows.
    for (const path of paths)
      asked.delete(path)
    console.warn('failed to read photo names:', error)
  }
}

/** Queues path's name to be read with the others asked for in the same tick. */
function requestName(path: string) {
  if (names.has(path) || asked.has(path))
    return
  asked.add(path)
  queued.add(path)
  flushTimer ??= setTimeout(() => void flush(), 0)
}

function needsName(photo: Photo | null): boolean {
  return photo !== null && photo.fileName === '' && isLibraryPath(photo.path)
}

/** The photo's file name, read when first shown for a library photo; '' meanwhile. */
export function useFileName(photo: MaybeRefOrGetter<Photo | null>): ComputedRef<string> {
  watchEffect(() => {
    const current = toValue(photo)
    if (current && needsName(current))
      requestName(current.path)
  })
  return computed(() => {
    const current = toValue(photo)
    if (!current)
      return ''
    return needsName(current) ? names.get(current.path) ?? '' : current.fileName
  })
}
