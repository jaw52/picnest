export interface FolderEntry {
  name: string
  path: string
}

/** A folder added to the new-tab page. */
export interface RecentFolder {
  path: string
  name: string
  lastOpenedAt: number
}
