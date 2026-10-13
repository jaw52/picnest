import type { FolderEntry } from '~/types/folder'
import * as stylex from '@stylexjs/stylex'
import { useAtomValue } from 'jotai'
import { ChevronRight, Folder } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { folderNameFromPath, folderRoots, pathSegments, recentFoldersAtom } from '~/atoms/recentFolders'
import { activeTabPathAtom } from '~/atoms/tabs'
import { DropdownMenu } from '~/components/ContextMenu'
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
 * A chevron after a folder that drops down that folder's subfolders; picking
 * one opens it in its own tab, next to this one.
 */
function SubfolderMenu({ folder, hideIfEmpty }: { folder: string, hideIfEmpty: boolean }) {
  const { openInNewTab } = useTabs()
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

  if (hideIfEmpty && !subfolders?.length)
    return null

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open)
          setVersion(v => v + 1)
      }}
      items={(subfolders ?? []).map(entry => ({
        label: entry.name,
        icon: Folder,
        onSelect: () => openInNewTab(entry.path),
      }))}
      trigger={(
        <button
          type="button"
          aria-label={`${folderNameFromPath(folder)} 的子文件夹`}
          {...stylex.props(styles.chevron)}
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      )}
    />
  )
}

/**
 * Breadcrumbs for the active tab's folder: click a parent to go up, or a
 * chevron to open one of that folder's subfolders in a new tab.
 */
export function PathBar() {
  const path = useAtomValue(activeTabPathAtom)
  const recentFolders = useAtomValue(recentFoldersAtom)
  const { openInActiveTab } = useTabs()
  const segments = useMemo(
    () => (path ? pathSegments(path, folderRoots(recentFolders).map(f => f.path)) : []),
    [path, recentFolders],
  )

  return (
    <nav aria-label="文件夹路径" {...stylex.props(styles.bar)}>
      {segments.map((segment, i) => {
        const isCurrent = i === segments.length - 1
        return (
          <Fragment key={segment}>
            <button
              type="button"
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => {
                if (!isCurrent)
                  openInActiveTab(segment)
              }}
              {...stylex.props(styles.segment, isCurrent && styles.current, text.caption)}
            >
              {i === 0 && <Folder size={14} strokeWidth={1.5} {...stylex.props(styles.icon)} />}
              <span {...stylex.props(utility.truncate, isCurrent ? weight.semibold : weight.normal)}>
                {folderNameFromPath(segment)}
              </span>
            </button>
            <SubfolderMenu folder={segment} hideIfEmpty={isCurrent} />
          </Fragment>
        )
      })}
    </nav>
  )
}
