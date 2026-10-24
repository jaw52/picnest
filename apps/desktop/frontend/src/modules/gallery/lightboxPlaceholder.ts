import type { Placeholder } from '~/types/lightbox'
import type { Photo } from '~/types/photo'
import { largestCachedThumbnail } from '~/composables/useThumbnail'
import { isLibraryPath } from '~/lib/library'

/**
 * What stands in for a photo in the Photos library while it loads: its
 * thumbnail from the grid or the filmstrip. Reading the photo itself goes
 * through Photos, and may download it from iCloud, so the viewer moves on
 * with the thumbnail rather than wait. A file on disk loads fast enough to
 * wait for.
 */
export function placeholderFor(folderPath: string | null, photo: Photo): Placeholder | undefined {
  const src = isLibraryPath(folderPath) ? largestCachedThumbnail(folderPath, photo.path) : undefined
  return src ? { src, width: photo.width, height: photo.height } : undefined
}
