import type { TFunction } from 'i18next'

import type { ContextMenuItem } from '~/components/ContextMenu'
import { openPath, writeText } from '~/lib/native'
import CopyRegular from '~icons/mingcute/copy-line'
import FolderOpenRegular from '~icons/mingcute/folder-open-line'

/** Copy Path and Reveal in Finder, for a menu on anything with a folder behind it. */
export function pathMenuItems(t: TFunction, path: string): ContextMenuItem[] {
  return [
    { label: t('common.copyPath'), icon: CopyRegular, onSelect: () => void writeText(path) },
    {
      label: t('common.revealInFinder'),
      icon: FolderOpenRegular,
      onSelect: () => void openPath(path).catch((error) => console.warn(`failed to open ${path}:`, error)),
    },
  ]
}
