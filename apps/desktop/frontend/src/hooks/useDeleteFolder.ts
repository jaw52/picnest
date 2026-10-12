import { useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { folderNameFromPath, recentFoldersAtom, withFolderRemoved } from '~/atoms/recentFolders'
import { useTabs } from '~/hooks/useTabs'
import { deleteFolder } from '~/lib/backend'
import { ask, message } from '~/lib/native'

export function useDeleteFolder() {
  const setRecentFolders = useSetAtom(recentFoldersAtom)
  const { closeFolderTabs } = useTabs()

  return useCallback(
    async (folderPath: string) => {
      const confirmed = await ask(`确定要将「${folderNameFromPath(folderPath)}」移到废纸篓吗？`, {
        title: '删除文件夹',
        kind: 'warning',
      })
      if (!confirmed)
        return

      try {
        await deleteFolder(folderPath)
      }
      catch (error) {
        await message(`删除失败：${error}`, { title: '删除文件夹', kind: 'error' })
        return
      }

      setRecentFolders(prev => withFolderRemoved(prev, folderPath))
      closeFolderTabs(folderPath)
    },
    [setRecentFolders, closeFolderTabs],
  )
}
