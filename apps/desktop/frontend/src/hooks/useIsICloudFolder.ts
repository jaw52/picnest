import { useEffect, useState } from 'react'
import { isICloudFolder } from '~/lib/backend'

/** Whether each folder is in iCloud Drive, asked once per folder. */
const iCloudFolders = new Map<string, boolean>()

/**
 * Whether a folder is in iCloud Drive (a synced Desktop or Documents folder
 * included); undefined until known.
 */
export function useIsICloudFolder(path: string | null): boolean | undefined {
  const [fetched, setFetched] = useState<{ path: string, iCloud: boolean }>()
  const cached = path === null ? undefined : iCloudFolders.get(path)
  useEffect(() => {
    if (path === null || iCloudFolders.has(path))
      return
    let live = true
    void isICloudFolder(path)
      .catch(() => false)
      .then((iCloud) => {
        iCloudFolders.set(path, iCloud)
        if (live)
          setFetched({ path, iCloud })
      })
    return () => {
      live = false
    }
  }, [path])
  return cached ?? (fetched?.path === path ? fetched.iCloud : undefined)
}
