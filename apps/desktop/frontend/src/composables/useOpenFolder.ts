import type { Photo } from '~/types/photo'
import { listSubfolders, scanFolderPage } from '~/lib/backend'
import { withFolderRemoved } from '~/lib/folders'
import { toPhoto } from '~/lib/photo'
import { photoGrouping, useGallery } from '~/state/gallery'
import { recentFolders } from '~/state/recentFolders'

// How many photos to fetch per backend round-trip. Keeps a single scan from
// becoming one giant IPC payload (and, for new/changed files, one giant
// batch of dimension probes) - the grid can start rendering the first page
// while later pages are still loading in the background.
const PAGE_SIZE = 300

/**
 * Fetches `folder`'s pages after the ones in `photos`, appending each to it
 * and handing it to `onPage`. False if the scan was superseded meanwhile.
 */
async function loadRemainingPages(
  folder: string,
  photos: Photo[],
  total: number,
  isLatest: () => boolean,
  onPage?: (page: Photo[]) => void,
): Promise<boolean> {
  while (photos.length < total) {
    const page = await scanFolderPage(folder, photos.length, PAGE_SIZE)
    if (!isLatest())
      return false
    if (page.photos.length === 0)
      break // Shrunk on disk mid-scan; avoid looping forever.
    const more = page.photos.map(p => toPhoto(p))
    photos.push(...more)
    onPage?.(more)
  }
  return true
}

/** A folder's subfolders, or none if they can't be listed; the photos still show. */
async function subfoldersOf(folder: string) {
  return listSubfolders(folder).catch((error: unknown) => {
    console.warn(`failed to list subfolders of ${folder}:`, error)
    return []
  })
}

export interface FolderLoader {
  navigateToFolder: (folder: string) => Promise<boolean>
  refreshFolder: (folder: string) => Promise<boolean>
  closeFolder: () => void
}

/**
 * Loads folders into the tab it is used in - each tab has a gallery of its
 * own (see TabPane) - and keeps them up to date.
 */
export function useOpenFolder(): FolderLoader {
  const gallery = useGallery()
  // startScan guards against a slow page fetch from a folder the tab has
  // since gone on from clobbering the newer folder's photos.
  const { currentFolder, photos, subfolders, photosTotal, isScanning, selectedPhotoIds, selectedPhotoId, startScan } = gallery

  async function scanAndSelect(folder: string): Promise<boolean> {
    const isLatest = startScan()
    isScanning.value = true
    selectedPhotoIds.value = new Set()
    selectedPhotoId.value = null
    gallery.setPreviewPhotoId(null)
    try {
      const [first, entries] = await Promise.all([
        scanFolderPage(folder, 0, PAGE_SIZE),
        subfoldersOf(folder),
      ])
      if (!isLatest())
        return true
      const firstPhotos = first.photos.map(p => toPhoto(p))

      // The previous folder stays on screen until now, then everything
      // the grid shows changes in one render.
      subfolders.value = entries
      photos.value = firstPhotos
      photosTotal.value = first.total
      currentFolder.value = folder

      // While grouped by when they were taken, the later pages are held
      // back and shown all at once when the scan is done: each would sort
      // photos in among the ones on screen and lay the grid out afresh.
      const held: Photo[] = []
      const showHeld = () => {
        const more = held.splice(0)
        if (more.length > 0)
          photos.value = [...photos.value, ...more]
      }
      // A copy: the pages are appended to the gallery's photos, and pushing
      // them onto the array it holds too would add them twice.
      const done = await loadRemainingPages(folder, [...firstPhotos], first.total, isLatest, (more) => {
        held.push(...more)
        if (photoGrouping.value === null)
          showHeld()
      })
      if (done)
        showHeld()
      return true
    }
    catch (error) {
      console.warn(`failed to open folder ${folder}:`, error)
      return false
    }
    finally {
      if (isLatest())
        isScanning.value = false
    }
  }

  /**
   * Rescans `folder` in place after on-disk changes (delete, move, external
   * edits). Unlike `navigateToFolder` it never empties the grid mid-scan -
   * all pages are fetched first and swapped in at once - so the scroll
   * position survives, and selection/preview are kept for photos that still
   * exist. A no-op resolving `true` if the user has since switched folders.
   */
  async function refreshFolder(folder: string): Promise<boolean> {
    const isLatest = startScan()
    try {
      const [first, entries] = await Promise.all([
        scanFolderPage(folder, 0, PAGE_SIZE),
        subfoldersOf(folder),
      ])
      const scanned = first.photos.map(p => toPhoto(p))
      while (scanned.length < first.total) {
        const page = await scanFolderPage(folder, scanned.length, PAGE_SIZE)
        if (page.photos.length === 0)
          break // Shrunk on disk mid-scan.
        scanned.push(...page.photos.map(p => toPhoto(p)))
      }
      if (!isLatest() || currentFolder.value !== folder)
        return true

      const ids = new Set(scanned.map(p => p.id))
      subfolders.value = entries
      photos.value = scanned
      photosTotal.value = first.total
      if ([...selectedPhotoIds.value].some(id => !ids.has(id)))
        selectedPhotoIds.value = new Set([...selectedPhotoIds.value].filter(id => ids.has(id)))
      const anchorId = selectedPhotoId.value
      if (anchorId && !ids.has(anchorId))
        selectedPhotoId.value = null
      const previewId = gallery.previewPhotoId.value
      if (previewId && !ids.has(previewId))
        gallery.setPreviewPhotoId(null)
      return true
    }
    catch (error) {
      console.warn(`failed to refresh folder ${folder}:`, error)
      return false
    }
  }

  /**
   * Loads `folder` into the gallery, keeping the rating filter. Driven by
   * the tab (see TabPane) - doesn't touch the bookmarked folders, except to
   * drop one that can no longer be read.
   */
  async function navigateToFolder(folder: string): Promise<boolean> {
    const ok = await scanAndSelect(folder)
    if (!ok) {
      // The folder was likely moved/deleted/unmounted; if it was
      // bookmarked, drop the now-dead shortcut.
      recentFolders.value = withFolderRemoved(recentFolders.value, folder)
    }
    return ok
  }

  /**
   * Clears the open folder back to the empty state. Used when the tab goes
   * on to the new-tab page.
   */
  function closeFolder() {
    startScan() // Invalidates any in-flight scan for the folder being closed.
    currentFolder.value = null
    photos.value = []
    subfolders.value = []
    photosTotal.value = 0
    selectedPhotoIds.value = new Set()
    selectedPhotoId.value = null
    gallery.setPreviewPhotoId(null)
    isScanning.value = false
  }

  return { navigateToFolder, refreshFolder, closeFolder }
}
