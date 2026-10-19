import type { Photo } from '~/types/photo'
import { useAtom, useSetAtom, useStore } from 'jotai'
import { useCallback } from 'react'

import {
  currentFolderAtom,
  isScanningAtom,
  photoGroupingAtom,
  photosAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  scanIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  subfoldersAtom,
} from '~/atoms/gallery'
import { recentFoldersAtom, withFolderRemoved } from '~/atoms/recentFolders'
import { listSubfolders, scanFolderPage } from '~/lib/backend'
import { toPhoto } from '~/lib/photo'

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
) {
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
function subfoldersOf(folder: string) {
  return listSubfolders(folder).catch((error) => {
    console.warn(`failed to list subfolders of ${folder}:`, error)
    return []
  })
}

/**
 * Loads folders into the tab it is used in - each tab has a gallery of its
 * own (see TabPane) - and keeps them up to date.
 */
export function useOpenFolder() {
  const store = useStore()
  // Guards against a slow page fetch from a folder the tab has since gone
  // on from clobbering the newer folder's photos.
  const startScan = useCallback(() => {
    const scanId = store.get(scanIdAtom) + 1
    store.set(scanIdAtom, scanId)
    return () => store.get(scanIdAtom) === scanId
  }, [store])
  const [currentFolder, setCurrentFolder] = useAtom(currentFolderAtom)
  const setPhotos = useSetAtom(photosAtom)
  const setSubfolders = useSetAtom(subfoldersAtom)
  const setPhotosTotal = useSetAtom(photosTotalAtom)
  const [isScanning, setIsScanning] = useAtom(isScanningAtom)
  const setRecentFolders = useSetAtom(recentFoldersAtom)
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const setAnchorId = useSetAtom(selectedPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)

  const scanAndSelect = useCallback(
    async (folder: string): Promise<boolean> => {
      const isLatest = startScan()
      setIsScanning(true)
      setSelectedIds(new Set())
      setAnchorId(null)
      setPreviewId(null)
      try {
        const [first, subfolders] = await Promise.all([
          scanFolderPage(folder, 0, PAGE_SIZE),
          subfoldersOf(folder),
        ])
        if (!isLatest())
          return true
        const photos = first.photos.map(p => toPhoto(p))

        // The previous folder stays on screen until now, then everything
        // the grid shows changes in one render.
        setSubfolders(subfolders)
        setPhotos(photos)
        setPhotosTotal(first.total)
        setCurrentFolder(folder)

        // While grouped by when they were taken, the later pages are held
        // back and shown all at once when the scan is done: each would sort
        // photos in among the ones on screen and lay the grid out afresh.
        const held: Photo[] = []
        const showHeld = () => {
          const more = held.splice(0)
          if (more.length > 0)
            setPhotos(prev => [...prev, ...more])
        }
        // A copy: the pages are appended to the atom's photos, and pushing
        // them onto the array it holds too would add them twice.
        const done = await loadRemainingPages(folder, [...photos], first.total, isLatest, (more) => {
          held.push(...more)
          if (store.get(photoGroupingAtom) === null)
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
          setIsScanning(false)
      }
    },
    [
      store,
      startScan,
      setCurrentFolder,
      setPhotos,
      setSubfolders,
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
      const isLatest = startScan()
      try {
        const [first, subfolders] = await Promise.all([
          scanFolderPage(folder, 0, PAGE_SIZE),
          subfoldersOf(folder),
        ])
        const photos = first.photos.map(p => toPhoto(p))
        while (photos.length < first.total) {
          const page = await scanFolderPage(folder, photos.length, PAGE_SIZE)
          if (page.photos.length === 0)
            break // Shrunk on disk mid-scan.
          photos.push(...page.photos.map(p => toPhoto(p)))
        }
        if (!isLatest() || store.get(currentFolderAtom) !== folder)
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
    [store, startScan, setPhotos, setSubfolders, setPhotosTotal, setSelectedIds, setAnchorId, setPreviewId],
  )

  /**
   * Loads `folder` into the gallery, keeping the rating filter. Driven by
   * the tab (see TabSync) - doesn't touch the bookmarked folders, except to
   * drop one that can no longer be read.
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
   * Clears the open folder back to the empty state. Used when the tab goes
   * on to the new-tab page.
   */
  const closeFolder = useCallback(() => {
    startScan() // Invalidates any in-flight scan for the folder being closed.
    setCurrentFolder(null)
    setPhotos([])
    setSubfolders([])
    setPhotosTotal(0)
    setSelectedIds(new Set())
    setAnchorId(null)
    setPreviewId(null)
    setIsScanning(false)
  }, [
    startScan,
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
