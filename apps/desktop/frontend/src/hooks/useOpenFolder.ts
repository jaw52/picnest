import type { RatingFilter } from '~/lib/photo'
import type { Photo } from '~/types/photo'
import { useAtom, useSetAtom, useStore } from 'jotai'
import { useCallback } from 'react'

import {
  currentFolderAtom,
  isScanningAtom,
  pendingScrollAtom,
  photosAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  ratingFilterAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  subfoldersAtom,
} from '~/atoms/gallery'
import { recentFoldersAtom, withFolderRemoved } from '~/atoms/recentFolders'
import { listSubfolders, scanFolderPage, unwatchFolder, watchFolder } from '~/lib/backend'
import { toPhoto } from '~/lib/photo'

// How many photos to fetch per backend round-trip. Keeps a single scan from
// becoming one giant IPC payload (and, for new/changed files, one giant
// batch of dimension probes) - the grid can start rendering the first page
// while later pages are still loading in the background.
const PAGE_SIZE = 300

// Guards against a slow page fetch from a folder the user has since
// navigated away from clobbering the newer folder's photos. Module-level
// because `useOpenFolder` is called from multiple components that all need
// to agree on which scan is the latest one.
let latestScanId = 0

/**
 * How a folder is shown: what a tab switched back to puts back. Left out,
 * the rating filter stays as it is and the rest starts afresh.
 */
export interface FolderView {
  ratingFilter: RatingFilter
  scrollY: number
  selectedIds: ReadonlySet<string>
  anchorId: string | null
}

/**
 * Fetches `folder`'s pages after the ones in `photos`, appending each to it
 * and handing it to `onPage`. False if `scanId` was superseded meanwhile.
 */
async function loadRemainingPages(
  folder: string,
  photos: Photo[],
  total: number,
  scanId: number,
  onPage?: (page: Photo[]) => void,
) {
  while (photos.length < total) {
    const page = await scanFolderPage(folder, photos.length, PAGE_SIZE)
    if (scanId !== latestScanId)
      return false
    if (page.photos.length === 0)
      break // Shrunk on disk mid-scan; avoid looping forever.
    const more = page.photos.map(toPhoto)
    photos.push(...more)
    onPage?.(more)
  }
  return true
}

/** A folder's subfolders, or none if they can't be listed; the photos still show. */
function subfoldersOf(folder: string) {
  return listSubfolders(folder).catch((error) => {
    console.warn(`failed to list subfolders of ${folder}:`, error)
    return []
  })
}

export function useOpenFolder() {
  const store = useStore()
  const [currentFolder, setCurrentFolder] = useAtom(currentFolderAtom)
  const setPhotos = useSetAtom(photosAtom)
  const setSubfolders = useSetAtom(subfoldersAtom)
  const setPhotosTotal = useSetAtom(photosTotalAtom)
  const [isScanning, setIsScanning] = useAtom(isScanningAtom)
  const setRecentFolders = useSetAtom(recentFoldersAtom)
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const setAnchorId = useSetAtom(selectedPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  const setRatingFilter = useSetAtom(ratingFilterAtom)
  const setPendingScroll = useSetAtom(pendingScrollAtom)

  const scanAndSelect = useCallback(
    async (folder: string, view: Partial<FolderView>): Promise<boolean> => {
      const scanId = ++latestScanId
      setIsScanning(true)
      setSelectedIds(new Set())
      setAnchorId(null)
      setPreviewId(null)
      try {
        const [first, subfolders] = await Promise.all([
          scanFolderPage(folder, 0, PAGE_SIZE),
          subfoldersOf(folder),
        ])
        if (scanId !== latestScanId)
          return true
        const photos = first.photos.map(toPhoto)
        // A scroll position to go back to needs the grid's full height, so
        // every page loads before the swap.
        if (view.scrollY !== undefined && !await loadRemainingPages(folder, photos, first.total, scanId))
          return true

        // The previous folder stays on screen until now, then everything
        // the grid shows changes in one render.
        const ids = new Set(photos.map(p => p.id))
        setSubfolders(subfolders)
        setPhotos(photos)
        setPhotosTotal(first.total)
        setCurrentFolder(folder)
        if (view.ratingFilter !== undefined)
          setRatingFilter(view.ratingFilter)
        setSelectedIds(new Set([...view.selectedIds ?? []].filter(id => ids.has(id))))
        setAnchorId(view.anchorId && ids.has(view.anchorId) ? view.anchorId : null)
        setPendingScroll(view.scrollY ?? 0)
        void watchFolder(folder).catch((error) => {
          console.warn(`failed to watch folder ${folder}:`, error)
        })

        await loadRemainingPages(folder, photos, first.total, scanId, (more) => {
          setPhotos(prev => [...prev, ...more])
        })
        return true
      }
      catch (error) {
        console.warn(`failed to open folder ${folder}:`, error)
        return false
      }
      finally {
        if (scanId === latestScanId)
          setIsScanning(false)
      }
    },
    [
      setCurrentFolder,
      setPhotos,
      setSubfolders,
      setPhotosTotal,
      setIsScanning,
      setSelectedIds,
      setAnchorId,
      setPreviewId,
      setRatingFilter,
      setPendingScroll,
    ],
  )

  /**
   * Rescans `folder` in place after on-disk changes (delete, move, external
   * edits). Unlike `navigateToFolder` it never empties the grid mid-scan -
   * all pages are fetched first and swapped in at once - so the scroll
   * position survives, and selection/preview are kept for photos that still
   * exist. A no-op resolving `true` if the user has since switched folders.
   */
  const refreshFolder = useCallback(
    async (folder: string): Promise<boolean> => {
      const scanId = ++latestScanId
      try {
        const [first, subfolders] = await Promise.all([
          scanFolderPage(folder, 0, PAGE_SIZE),
          subfoldersOf(folder),
        ])
        const photos = first.photos.map(toPhoto)
        while (photos.length < first.total) {
          const page = await scanFolderPage(folder, photos.length, PAGE_SIZE)
          if (page.photos.length === 0)
            break // Shrunk on disk mid-scan.
          photos.push(...page.photos.map(toPhoto))
        }
        if (scanId !== latestScanId || store.get(currentFolderAtom) !== folder)
          return true

        const ids = new Set(photos.map(p => p.id))
        setSubfolders(subfolders)
        setPhotos(photos)
        setPhotosTotal(first.total)
        setSelectedIds(prev =>
          [...prev].every(id => ids.has(id))
            ? prev
            : new Set([...prev].filter(id => ids.has(id))),
        )
        const anchorId = store.get(selectedPhotoIdAtom)
        if (anchorId && !ids.has(anchorId))
          setAnchorId(null)
        const previewId = store.get(previewPhotoIdAtom)
        if (previewId && !ids.has(previewId))
          setPreviewId(null)
        return true
      }
      catch (error) {
        console.warn(`failed to refresh folder ${folder}:`, error)
        return false
      }
    },
    [store, setPhotos, setSubfolders, setPhotosTotal, setSelectedIds, setAnchorId, setPreviewId],
  )

  /**
   * Loads `folder` into the gallery. Driven by the active tab (see
   * useActiveTabSync) - doesn't touch the bookmarked folders, except to drop
   * one that can no longer be read.
   */
  const navigateToFolder = useCallback(
    async (folder: string, view: Partial<FolderView> = {}): Promise<boolean> => {
      const ok = await scanAndSelect(folder, view)
      if (!ok) {
        // The folder was likely moved/deleted/unmounted; if it was
        // bookmarked, drop the now-dead shortcut.
        setRecentFolders(prev => withFolderRemoved(prev, folder))
      }
      return ok
    },
    [scanAndSelect, setRecentFolders],
  )

  /**
   * Clears the open folder back to the empty state and stops the backend's
   * folder watcher. Used when the active tab switches to the new-tab page.
   */
  const closeFolder = useCallback(() => {
    latestScanId++ // Invalidate any in-flight scan for the folder being closed.
    setCurrentFolder(null)
    setPhotos([])
    setSubfolders([])
    setPhotosTotal(0)
    setSelectedIds(new Set())
    setAnchorId(null)
    setPreviewId(null)
    setIsScanning(false)
    void unwatchFolder().catch((error) => {
      console.warn('failed to stop folder watcher:', error)
    })
  }, [
    setCurrentFolder,
    setPhotos,
    setSubfolders,
    setPhotosTotal,
    setSelectedIds,
    setAnchorId,
    setPreviewId,
    setIsScanning,
  ])

  return {
    currentFolder,
    isScanning,
    navigateToFolder,
    refreshFolder,
    closeFolder,
  }
}
