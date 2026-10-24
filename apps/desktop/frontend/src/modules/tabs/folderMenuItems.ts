import type { MenuItem } from '~/types/menu'
import { t } from '~/i18n'
import { pathMenuItems } from './pathMenuItems'

/** The menu every folder gets; `onOpenInNewTab`, `onRemove` and `onDelete` add their items. */
export function folderMenuItems(
  path: string,
  { onOpenInNewTab, onRemove, onDelete }: { onOpenInNewTab?: () => void, onRemove?: () => void, onDelete?: () => void },
): MenuItem[] {
  return [
    ...(onOpenInNewTab ? [{ label: t('tabs.openInNewTab'), icon: 'i-mingcute-external-link-line', onSelect: onOpenInNewTab }] : []),
    ...pathMenuItems(path),
    ...(onRemove ? [{ label: t('tabs.removeFromList'), icon: 'i-mingcute-close-line', onSelect: onRemove }] : []),
    ...(onDelete ? [{ label: t('dialogs.deleteFolderTitle'), icon: 'i-mingcute-folder-delete-line', destructive: true, onSelect: onDelete }] : []),
  ]
}
