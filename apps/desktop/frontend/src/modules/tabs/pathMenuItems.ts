import type { MenuItem } from '~/types/menu'
import { t } from '~/i18n'
import { openPath, writeText } from '~/lib/native'

/** Copy Path and Reveal in Finder, for a menu on anything with a folder behind it. */
export function pathMenuItems(path: string): MenuItem[] {
  return [
    { label: t('common.copyPath'), icon: 'i-mingcute-copy-line', onSelect: () => void writeText(path) },
    {
      label: t('common.revealInFinder'),
      icon: 'i-mingcute-folder-open-line',
      onSelect: () =>
        void openPath(path).catch((error: unknown) => console.warn(`failed to open ${path}:`, error)),
    },
  ]
}
