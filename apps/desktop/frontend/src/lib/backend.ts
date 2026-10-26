import type { DeleteResult, LibraryAccess, TrashedPhoto } from '~/mygo'
import { App } from '~/mygo'
import type { FolderEntry } from '~/types/folder'
import type { PhotoDetails, PhotoPage } from '~/types/photo'

import { convertFileSrc } from './native'

/**
 * Go errors reach JS as `CallError`s; callers format rejections with
 * `${error}`, so unwrap them to the plain message string.
 */
async function call<T>(promise: PromiseLike<T>): Promise<T> {
  try {
    return await promise
  } catch (error) {
    throw error instanceof Error ? error.message : error
  }
}

export function scanFolderPage(folderPath: string, offset: number, limit: number): Promise<PhotoPage> {
  return call(App.scanFolderPage(folderPath, offset, limit))
}

/**
 * Starts watching `folderPath` for on-disk changes (files added/removed/
 * renamed); the backend emits a `folder-changed` event with its path when
 * that happens. Each tab showing a folder watches it, so every call wants an
 * `unwatchFolder` of the same folder once its tab is done with it.
 */
export function watchFolder(folderPath: string): Promise<void> {
  return call(App.watchFolder(folderPath))
}

/** Undoes a `watchFolder` of `folderPath`. */
export function unwatchFolder(folderPath: string): Promise<void> {
  return call(App.unwatchFolder(folderPath))
}

/** Rejection message of a thumbnail request aborted through its signal. */
export const THUMBNAIL_CANCELLED = 'thumbnail-cancelled'

let thumbnailRequestSeq = 0

/**
 * Resolves a thumbnail's URL, generating it if needed. Aborting `signal`
 * drops the request from the backend queue if it hasn't started decoding
 * yet; it then rejects with THUMBNAIL_CANCELLED.
 */
export async function ensureThumbnailUrl(
  folderPath: string,
  filePath: string,
  maxEdge: number,
  { background = false, signal }: { background?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const requestId = signal ? String(++thumbnailRequestSeq) : ''
  const cancel = () => void App.cancelThumbnail(requestId)
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const thumbPath = await call(App.ensureThumbnail(folderPath, filePath, maxEdge, background, requestId))
    return convertFileSrc(thumbPath)
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}

export function setRating(folderPath: string, filePath: string, rating: number): Promise<void> {
  return call(App.setRating(folderPath, filePath, rating))
}

/** The names photos in the Photos library had when imported, by path; scans leave them out. */
export async function libraryFileNames(paths: string[]): Promise<Record<string, string>> {
  return (await call(App.libraryFileNames(paths))) ?? {}
}

/** Whether the Photos library may be read, without asking. */
export function libraryAccess(): Promise<LibraryAccess> {
  return call(App.libraryAccess())
}

/** Asks for the Photos library, with the system prompt the first time. */
export function requestLibraryAccess(): Promise<LibraryAccess> {
  return call(App.requestLibraryAccess())
}

/** Opens System Settings where Photos access refused earlier can be granted. */
export function openLibraryPrivacySettings(): Promise<void> {
  return call(App.openLibraryPrivacySettings())
}

export async function listSubfolders(folderPath: string): Promise<FolderEntry[]> {
  return (await call(App.listSubfolders(folderPath))) ?? []
}

/** Whether a folder is in iCloud Drive, including a Desktop or Documents folder synced to it. */
export function isICloudFolder(folderPath: string): Promise<boolean> {
  return call(App.isICloudFolder(folderPath))
}

export function getPhotoDetails(filePath: string): Promise<PhotoDetails> {
  return call(App.getPhotoDetails(filePath))
}

/** Asks iCloud Drive to fetch a not-yet-downloaded file; the download runs on in the background. */
export function downloadPlaceholder(filePath: string): Promise<void> {
  return call(App.downloadPlaceholder(filePath))
}

/** Moves photos to the trash; some may fail while the rest go. */
export function deletePhotos(folderPath: string, filePaths: string[]): Promise<DeleteResult> {
  return call(App.deletePhotos(folderPath, filePaths))
}

/** Puts trashed photos back into `folderPath`, ratings and all. */
export function restorePhotos(folderPath: string, photos: TrashedPhoto[]): Promise<void> {
  return call(App.restorePhotos(folderPath, photos))
}

/** Moves `folderPath` itself to the system trash. */
export function deleteFolder(folderPath: string): Promise<void> {
  return call(App.deleteFolder(folderPath))
}

export function renamePhoto(folderPath: string, oldName: string, newName: string): Promise<void> {
  return call(App.renamePhoto(folderPath, oldName, newName))
}

/**
 * Moves the named files out of `folderPath` into `destFolder`, carrying
 * their ratings along. Rejects with every per-file
 * failure joined by newlines; files that did move stay moved.
 */
export function movePhotos(folderPath: string, fileNames: string[], destFolder: string): Promise<void> {
  return call(App.movePhotos(folderPath, fileNames, destFolder))
}

export { pickFolder } from './native'
