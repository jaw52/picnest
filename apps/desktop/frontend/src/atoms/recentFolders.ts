import { atomWithStorage } from 'jotai/utils'

export interface RecentFolder {
  path: string
  name: string
  lastOpenedAt: number
}

const PATH_SEPARATOR_RE = /[/\\]/
const TRAILING_SEPARATOR_RE = /[/\\]+$/

export function isDescendantPath(path: string, parent: string): boolean {
  const prefix = parent.replace(TRAILING_SEPARATOR_RE, '')
  return path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}\\`)
}

export function folderRoots(folders: RecentFolder[]): RecentFolder[] {
  return folders.filter(
    folder =>
      !folders.some(
        other => other.path !== folder.path && isDescendantPath(folder.path, other.path),
      ),
  )
}

/**
 * The folders the user has added, listed on the new-tab page. Persisted in
 * the webview's localStorage, which survives app restarts.
 */
export const recentFoldersAtom = atomWithStorage<RecentFolder[]>('picnest.recentFolders', [])

export function folderNameFromPath(path: string): string {
  const parts = path.split(PATH_SEPARATOR_RE).filter(Boolean)
  return parts.at(-1) ?? path
}

export function withFolderAdded(folders: RecentFolder[], path: string): RecentFolder[] {
  const roots = folderRoots(folders)
  if (roots.some(f => f.path === path || isDescendantPath(path, f.path)))
    return roots
  const entry: RecentFolder = {
    path,
    name: folderNameFromPath(path),
    lastOpenedAt: Date.now(),
  }
  return folderRoots([...roots, entry])
}

export function withFolderRemoved(folders: RecentFolder[], path: string): RecentFolder[] {
  return folders.filter(f => f.path !== path && !isDescendantPath(f.path, path))
}

/**
 * The folders from the added folder the tab is in, down to the tab's folder.
 * A folder that isn't inside any added one (its shortcut was removed) is its
 * own root.
 */
export function pathSegments(path: string, roots: string[]): string[] {
  const root = roots.find(r => r === path || isDescendantPath(path, r))
  if (!root || root === path)
    return [path]
  const separator = path[root.replace(TRAILING_SEPARATOR_RE, '').length]
  const segments = [root]
  let current = root.replace(TRAILING_SEPARATOR_RE, '')
  for (const part of path.slice(current.length + 1).split(PATH_SEPARATOR_RE).filter(Boolean)) {
    current = `${current}${separator}${part}`
    segments.push(current)
  }
  return segments
}
