import { useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { folderNameFromPath, recentFoldersAtom, withFolderRemoved } from '~/atoms/recentFolders'
import { useTabs } from '~/hooks/useTabs'
import { i18n } from '~/i18n'
import { deleteFolder } from '~/lib/backend'
import { ask, message } from '~/lib/native'

export function useDeleteFolder() {
  const setRecentFolders = useSetAtom(recentFoldersAtom)
  const { closeFolderTabs } = useTabs()

  return useCallback(
    async (folderPath: string) => {
      const confirmed = await ask(i18n.t('dialogs.deleteFolderConfirm', { name: folderNameFromPath(folderPath) }), {
        title: i18n.t('dialogs.deleteFolderTitle'),
        kind: 'warning',
      })
      if (!confirmed) return

      try {
        await deleteFolder(folderPath)
      } catch (error) {
        await message(i18n.t('dialogs.deleteFailed', { error }), {
          title: i18n.t('dialogs.deleteFolderTitle'),
          kind: 'error',
        })
        return
      }

      setRecentFolders((prev) => withFolderRemoved(prev, folderPath))
      closeFolderTabs(folderPath)
    },
    [setRecentFolders, closeFolderTabs],
  )
}
