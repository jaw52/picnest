import { t } from '~/i18n'
import { deleteFolder } from '~/lib/backend'
import { folderNameFromPath, withFolderRemoved } from '~/lib/folders'
import { ask, message } from '~/lib/native'
import { recentFolders } from '~/state/recentFolders'
import { closeFolderTabs } from '~/state/tabs'

/** Moves a folder to the trash once the user confirms, closing the tabs inside it. */
export async function trashFolder(folderPath: string): Promise<void> {
  const confirmed = await ask(t('dialogs.deleteFolderConfirm', { name: folderNameFromPath(folderPath) }), {
    title: t('dialogs.deleteFolderTitle'),
    kind: 'warning',
  })
  if (!confirmed)
    return

  try {
    await deleteFolder(folderPath)
  }
  catch (error) {
    await message(t('dialogs.deleteFailed', { error: String(error) }), { title: t('dialogs.deleteFolderTitle'), kind: 'error' })
    return
  }

  recentFolders.value = withFolderRemoved(recentFolders.value, folderPath)
  closeFolderTabs(folderPath)
}
