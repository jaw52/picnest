import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, shallowRef, toValue, watch } from 'vue'
import { useThumbnail } from '~/composables/useThumbnail'
import { listSubfolders, scanFolderPage } from '~/lib/backend'

/**
 * Candidates read for the cover photo: the first few, in case the first ones
 * are undownloaded iCloud placeholders with nothing to show.
 */
const COVER_CANDIDATES = 6
/**
 * Subfolders looked into, in order, for a folder with no photos of its own,
 * so a folder that only groups others still shows what it holds.
 */
const SUBFOLDER_CANDIDATES = 6
/** Thumbnail edge for the previews: small, and shared with nothing else. */
const PREVIEW_EDGE = 256

interface Cover {
  /** The folder the photo is in, which owns its thumbnail. */
  folder: string
  path: string
}

async function firstPhoto(folderPath: string) {
  const page = await scanFolderPage(folderPath, 0, COVER_CANDIDATES)
  return page.photos.find(p => !p.isCloudPlaceholder)?.path ?? null
}

/** The folder's first photo, or failing that the first one in a subfolder. */
async function findCover(folderPath: string): Promise<Cover | null> {
  const own = await firstPhoto(folderPath)
  if (own)
    return { folder: folderPath, path: own }
  const subfolders = await listSubfolders(folderPath)
  for (const sub of subfolders.slice(0, SUBFOLDER_CANDIDATES)) {
    const path = await firstPhoto(sub.path)
    if (path)
      return { folder: sub.path, path }
  }
  return null
}

/** The thumbnail for the folder's icon; undefined until it loads or if there is none. */
export function useFolderCover(folderPath: MaybeRefOrGetter<string>): ComputedRef<string | undefined> {
  const cover = shallowRef<Cover | null>(null)
  watch(() => toValue(folderPath), (path, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    findCover(path)
      .then((found) => {
        if (!cancelled)
          cover.value = found
      })
      .catch((error: unknown) => console.warn(`failed to preview ${path}:`, error))
  }, { immediate: true })
  const url = useThumbnail(
    () => cover.value?.folder ?? toValue(folderPath),
    () => cover.value?.path ?? '',
    PREVIEW_EDGE,
    { enabled: () => cover.value !== null },
  )
  return computed(() => (cover.value ? url.value : undefined))
}
