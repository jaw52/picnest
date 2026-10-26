import { useAtomValue } from 'jotai'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { subfoldersAtom } from '~/atoms/gallery'
import { folderNameFromPath, folderRoots, pathSegments, recentFoldersAtom } from '~/atoms/recentFolders'
import { activeTabPathAtom, canGoBackAtom, canGoForwardAtom } from '~/atoms/tabs'
import { DropdownMenu } from '~/components/ContextMenu'
import { IconButton } from '~/components/IconButton'
import { useTabs } from '~/hooks/useTabs'
import { listSubfolders } from '~/lib/backend'
import { cn } from '~/lib/cn'
import { isLibraryPath } from '~/lib/library'
import type { FolderEntry } from '~/types/folder'
import ArrowLeftRegular from '~icons/mingcute/arrow-left-line'
import ArrowRightRegular from '~icons/mingcute/arrow-right-line'
import FolderRegular from '~icons/mingcute/folder-line'
import PicRegular from '~icons/mingcute/pic-line'
import RightRegular from '~icons/mingcute/right-line'

/**
 * A chevron between two folders of the path that drops down the first one's
 * subfolders, to jump to a sibling of the folder after it.
 */
function SubfolderMenu({ folder }: { folder: string }) {
  const { t } = useTranslation()
  const { openInActiveTab } = useTabs()
  const [subfolders, setSubfolders] = useState<FolderEntry[] | null>(null)
  // Bumped on every open, so folders created since show up.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    listSubfolders(folder)
      .then((entries) => {
        if (!cancelled) setSubfolders(entries)
      })
      .catch((error) => {
        console.warn(`failed to list subfolders of ${folder}:`, error)
        if (!cancelled) setSubfolders([])
      })
    return () => {
      cancelled = true
    }
  }, [folder, version])

  return (
    <DropdownMenu
      items={(subfolders ?? []).map((entry) => ({
        label: entry.name,
        icon: FolderRegular,
        onSelect: () => openInActiveTab(entry.path),
      }))}
      trigger={
        <button
          aria-label={t('path.subfolders', { name: folderNameFromPath(folder) })}
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded-item p-0 text-text-secondary transition-colors duration-80 hover:bg-text/5 hover:text-text data-popup-open:bg-text/10"
          type="button"
        >
          <RightRegular height={14} width={14} />
        </button>
      }
      onOpenChange={(open) => {
        if (open) setVersion((v) => v + 1)
      }}
    />
  )
}

/**
 * Back and forward through the folders the tab showed, then breadcrumbs for
 * the one it shows: click a parent to go up (⌘-click for a new tab), or a
 * chevron to jump to a sibling. Left out while there is nowhere to go: a
 * top-level folder with no subfolders and no history.
 */
export function PathBar() {
  const { t } = useTranslation()
  const path = useAtomValue(activeTabPathAtom)
  const recentFolders = useAtomValue(recentFoldersAtom)
  const canGoBack = useAtomValue(canGoBackAtom)
  const canGoForward = useAtomValue(canGoForwardAtom)
  const hasSubfolders = useAtomValue(subfoldersAtom).length > 0
  const { openFromClick, goBack, goForward } = useTabs()
  const segments = useMemo(
    () =>
      path
        ? pathSegments(
            path,
            folderRoots(recentFolders).map((f) => f.path),
          )
        : [],
    [path, recentFolders],
  )

  if (segments.length <= 1 && !hasSubfolders && !canGoBack && !canGoForward) return null

  return (
    <nav aria-label={t('path.breadcrumb')} className="flex min-w-0 items-center gap-0.5">
      <div className="mr-1.5 flex shrink-0 gap-0.5">
        <IconButton disabled={!canGoBack} icon={ArrowLeftRegular} label={t('path.back')} onClick={goBack} />
        <IconButton disabled={!canGoForward} icon={ArrowRightRegular} label={t('path.forward')} onClick={goForward} />
      </div>
      {segments.map((segment, i) => {
        const isCurrent = i === segments.length - 1
        const library = isLibraryPath(segment)
        const SegmentIcon = library ? PicRegular : FolderRegular
        return (
          <Fragment key={segment}>
            <button
              aria-current={isCurrent ? 'page' : undefined}
              type="button"
              className={cn(
                'flex h-6 max-w-50 min-w-0 items-center gap-1.5 rounded-item px-1.5 text-caption transition-colors duration-80',
                isCurrent ? 'cursor-default text-text' : 'text-text-secondary hover:bg-text/5 hover:text-text',
              )}
              onAuxClick={(e) => {
                if (!isCurrent && e.button === 1) openFromClick(segment, e)
              }}
              onClick={(e) => {
                if (!isCurrent) openFromClick(segment, e)
              }}
            >
              {i === 0 && <SegmentIcon className="shrink-0" height={14} width={14} />}
              <span className={cn('truncate', isCurrent ? 'wght-semibold' : 'wght-normal')}>
                {library ? t('library.name') : folderNameFromPath(segment)}
              </span>
            </button>
            {/* The current folder's subfolders are in the grid below. */}
            {!isCurrent && <SubfolderMenu folder={segment} />}
          </Fragment>
        )
      })}
    </nav>
  )
}
