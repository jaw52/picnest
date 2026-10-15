/**
 * The Photos library opens in a tab like a folder, under this path; each of
 * its photos has this prefix followed by the asset's identifier. Its photos
 * can be browsed and rated, but not renamed, moved or deleted.
 */
export const LIBRARY_PATH = 'photos:'

export function isLibraryPath(path: string | null): boolean {
  return path?.startsWith(LIBRARY_PATH) ?? false
}
