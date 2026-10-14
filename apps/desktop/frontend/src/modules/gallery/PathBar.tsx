import type { FolderEntry } from '~/types/folder'
import { ArrowLeftRegular, ArrowRightRegular, FolderRegular, RightRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
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
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'

const styles = stylex.create({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  history: { display: 'flex', gap: 2, marginRight: 6, flexShrink: 0 },
  segment: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    maxWidth: 200,
    height: 24,
    paddingInline: 6,
    borderWidth: 0,
    borderRadius: radius.item,
    cursor: 'pointer',
    color: { 'default': colors['--ps-muted-foreground'], ':hover': colors['--ps-foreground'] },
    backgroundColor: { 'default': 'transparent', ':hover': colors['--ps-hover'] },
    transitionProperty: 'color, background-color',
    transitionDuration: '80ms',
  },
  current: {
    cursor: 'default',
    color: { 'default': colors['--ps-foreground'], ':hover': colors['--ps-foreground'] },
    backgroundColor: { 'default': 'transparent', ':hover': 'transparent' },
  },
  icon: { flexShrink: 0 },
  chevron: {
    display: 'flex',
    width: 20,
    height: 24,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderWidth: 0,
    borderRadius: radius.item,
    cursor: 'pointer',
    color: { 'default': colors['--ps-muted-foreground'], ':hover': colors['--ps-foreground'] },
    backgroundColor: {
      'default': 'transparent',
      ':hover': colors['--ps-hover'],
      ':is([data-popup-open])': colors['--ps-active'],
    },
    transitionProperty: 'color, background-color',
    transitionDuration: '80ms',
  },
})

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
        if (!cancelled)
          setSubfolders(entries)
      })
      .catch((error) => {
        console.warn(`failed to list subfolders of ${folder}:`, error)
        if (!cancelled)
          setSubfolders([])
      })
    return () => {
      cancelled = true
    }
  }, [folder, version])

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open)
          setVersion(v => v + 1)
      }}
      items={(subfolders ?? []).map(entry => ({
        label: entry.name,
        icon: FolderRegular,
        onSelect: () => openInActiveTab(entry.path),
      }))}
      trigger={(
        <button
          type="button"
          aria-label={t('path.subfolders', { name: folderNameFromPath(folder) })}
          {...stylex.props(styles.chevron)}
        >
          <RightRegular size={14} />
        </button>
      )}
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
    () => (path ? pathSegments(path, folderRoots(recentFolders).map(f => f.path)) : []),
    [path, recentFolders],
  )

  if (segments.length <= 1 && !hasSubfolders && !canGoBack && !canGoForward)
    return null

  return (
    <nav aria-label={t('path.breadcrumb')} {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.history)}>
        <IconButton label={t('path.back')} icon={ArrowLeftRegular} disabled={!canGoBack} onClick={goBack} />
        <IconButton label={t('path.forward')} icon={ArrowRightRegular} disabled={!canGoForward} onClick={goForward} />
      </div>
      {segments.map((segment, i) => {
        const isCurrent = i === segments.length - 1
        return (
          <Fragment key={segment}>
            <button
              type="button"
              aria-current={isCurrent ? 'page' : undefined}
              onClick={(e) => {
                if (!isCurrent)
                  openFromClick(segment, e)
              }}
              onAuxClick={(e) => {
                if (!isCurrent && e.button === 1)
                  openFromClick(segment, e)
              }}
              {...stylex.props(styles.segment, isCurrent && styles.current, text.caption)}
            >
              {i === 0 && <FolderRegular size={14} {...stylex.props(styles.icon)} />}
              <span {...stylex.props(utility.truncate, isCurrent ? weight.semibold : weight.normal)}>
                {folderNameFromPath(segment)}
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
