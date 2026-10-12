import { useAtom, useSetAtom, useStore } from 'jotai'
import { useCallback } from 'react'

import {
  currentFolderAtom,
  isScanningAtom,
  photosAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { recentFoldersAtom, withFolderRemoved } from '~/atoms/recentFolders'
import { scanFolderPage, unwatchFolder, watchFolder } from '~/lib/backend'
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

export function useOpenFolder() {
  const store = useStore()
  const [currentFolder, setCurrentFolder] = useAtom(currentFolderAtom)
  const setPhotos = useSetAtom(photosAtom)
  const setPhotosTotal = useSetAtom(photosTotalAtom)
  const [isScanning, setIsScanning] = useAtom(isScanningAtom)
  const setRecentFolders = useSetAtom(recentFoldersAtom)
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const setAnchorId = useSetAtom(selectedPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)

  const scanAndSelect = useCallback(
    async (folder: string): Promise<boolean> => {
      const scanId = ++latestScanId
      setIsScanning(true)
      setPhotos([])
      setPhotosTotal(0)
      setSelectedIds(new Set())
      setAnchorId(null)
      setPreviewId(null)
      try {
        const first = await scanFolderPage(folder, 0, PAGE_SIZE)
        if (scanId !== latestScanId)
          return true
        setPhotos(first.photos.map(toPhoto))
        setPhotosTotal(first.total)
        setCurrentFolder(folder)
        void watchFolder(folder).catch((error) => {
          console.warn(`failed to watch folder ${folder}:`, error)
        })

        let loaded = first.photos.length
        while (loaded < first.total) {
          const page = await scanFolderPage(folder, loaded, PAGE_SIZE)
          if (scanId !== latestScanId)
            return true
          if (page.photos.length === 0)
            break // Shrunk on disk mid-scan; avoid looping forever.
          setPhotos(prev => [...prev, ...page.photos.map(toPhoto)])
          loaded += page.photos.length
        }
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
      setPhotosTotal,
      setIsScanning,
      setSelectedIds,
      setAnchorId,
      setPreviewId,
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
        const first = await scanFolderPage(folder, 0, PAGE_SIZE)
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
    [store, setPhotos, setPhotosTotal, setSelectedIds, setAnchorId, setPreviewId],
  )

  /**
   * Loads `folder` into the gallery. Driven by the active tab (see
   * useActiveTabSync) - doesn't touch the bookmarked folders, except to drop
   * one that can no longer be read.
   */
  const navigateToFolder = useCallback(
    async (folder: string): Promise<boolean> => {
      const ok = await scanAndSelect(folder)
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
