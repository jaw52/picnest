import type { CollectItem } from '~/mygo'
import * as stylex from '@stylexjs/stylex'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckCircleRegular from '~icons/mingcute/check-circle-line'
import CheckRegular from '~icons/mingcute/check-line'
import CloseCircleRegular from '~icons/mingcute/close-circle-line'
import DownRegular from '~icons/mingcute/down-small-line'
import DownloadRegular from '~icons/mingcute/download-2-line'
import FolderRegular from '~icons/mingcute/folder-line'
import FolderOpenRegular from '~icons/mingcute/folder-open-line'
import LoadingRegular from '~icons/mingcute/loading-3-line'
import { recentFoldersAtom } from '~/atoms/recentFolders'
import { DropdownMenu } from '~/components/ContextMenu'
import { IconButton } from '~/components/IconButton'
import { convertPreviewSrc, openPath } from '~/lib/native'
import { events, App as GoApp } from '~/mygo'
import { colors } from '~/theme/colors.stylex'
import { motion, radius } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'

const spin = stylex.keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

const styles = stylex.create({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    height: '100vh',
    boxSizing: 'border-box',
    padding: 12,
    borderRadius: radius.container,
    backgroundColor: colors['--ps-background'],
    color: colors['--ps-foreground'],
    overflow: 'hidden',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
    height: 112,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.item,
    borderColor: colors['--ps-border'],
    color: colors['--ps-muted-foreground'],
    transitionProperty: 'border-color, background-color, color, transform',
    transitionDuration: '160ms',
    transitionTimingFunction: motion.easeOut,
  },
  dropZoneOver: {
    borderStyle: 'solid',
    borderColor: colors['--ps-info'],
    backgroundColor: `color-mix(in srgb, ${colors['--ps-info']} 10%, transparent)`,
    color: colors['--ps-info'],
    transform: 'scale(1.02)',
  },
  dropIcon: { width: 24, height: 24 },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flexGrow: 1,
    minHeight: 0,
    overflowY: 'auto',
    marginInline: -4,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 4,
    borderRadius: radius.item,
  },
  thumb: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 6,
    objectFit: 'cover',
    backgroundColor: colors['--ps-muted'],
  },
  thumbPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors['--ps-muted-foreground'],
  },
  itemText: { display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 },
  muted: { color: colors['--ps-muted-foreground'] },
  failed: { color: colors['--ps-destructive'] },
  statusIcon: { flexShrink: 0, width: 16, height: 16 },
  saved: { color: colors['--ps-success'] },
  spinning: { animationName: spin, animationDuration: '0.9s', animationIterationCount: 'infinite', animationTimingFunction: 'linear' },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    minWidth: 0,
  },
  target: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    flexGrow: 1,
    height: 28,
    paddingInline: 6,
    marginLeft: -6,
    borderWidth: 0,
    borderRadius: radius.item,
    backgroundColor: { 'default': 'transparent', ':hover:enabled': colors['--ps-muted'] },
    cursor: { 'default': 'pointer', ':disabled': 'default' },
    color: colors['--ps-foreground'],
  },
  targetLabel: { flexShrink: 0, color: colors['--ps-muted-foreground'] },
  footerIcon: { flexShrink: 0, width: 14, height: 14 },
})

function fileName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  }
  catch {
    return ''
  }
}

function Item({ item }: { item: CollectItem }) {
  const { t } = useTranslation()
  const detail = item.status === 'saving'
    ? t('collect.saving')
    : item.status === 'failed'
      ? t('collect.failed')
      : host(item.pageUrl) || t('collect.saved')
  return (
    <div {...stylex.props(styles.item)} title={item.error || item.pageUrl}>
      {item.path
        ? <img src={convertPreviewSrc(item.path, 128)} alt="" {...stylex.props(styles.thumb)} />
        : (
            <span {...stylex.props(styles.thumb, styles.thumbPlaceholder)}>
              <DownloadRegular {...stylex.props(styles.statusIcon)} />
            </span>
          )}
      <span {...stylex.props(styles.itemText)}>
        <span {...stylex.props(text.caption, utility.truncate)}>
          {item.path ? fileName(item.path) : t('collect.picture')}
        </span>
        <span {...stylex.props(text.caption, utility.truncate, item.status === 'failed' ? styles.failed : styles.muted)}>
          {detail}
        </span>
      </span>
      {item.status === 'saving' && <LoadingRegular {...stylex.props(styles.statusIcon, styles.muted, styles.spinning)} />}
      {item.status === 'saved' && <CheckCircleRegular {...stylex.props(styles.statusIcon, styles.saved)} />}
      {item.status === 'failed' && <CloseCircleRegular {...stylex.props(styles.statusIcon, styles.failed)} />}
    </div>
  )
}

/**
 * Where dropped pictures go: one of the folders added on the new-tab page.
 * The Go side keeps the pick (see collect.go); while none is picked, or the
 * picked one is no longer listed, the first listed folder is.
 */
function SaveTarget() {
  const { t } = useTranslation()
  const folders = useAtomValue(recentFoldersAtom)
  // undefined until the Go side says; "" for none.
  const [target, setTarget] = useState<string>()

  useEffect(() => {
    void GoApp.collectTarget().then(setTarget)
  }, [])

  const pick = (dir: string) => {
    setTarget(dir)
    void GoApp.setCollectTarget(dir)
  }

  const current = target === undefined
    ? undefined
    : folders.find(folder => folder.path === target) ?? folders[0]
  // Tells the Go side when the pick falls to the first folder.
  useEffect(() => {
    if (target !== undefined && current?.path !== target)
      void GoApp.setCollectTarget(current?.path ?? '')
  }, [target, current])

  return (
    <div {...stylex.props(styles.footer)}>
      <DropdownMenu
        items={folders.map(folder => ({
          id: folder.path,
          label: folder.name,
          icon: folder.path === current?.path ? CheckRegular : FolderRegular,
          onSelect: () => pick(folder.path),
        }))}
        trigger={(
          <button
            type="button"
            disabled={folders.length === 0}
            title={current?.path}
            {...stylex.props(styles.target, text.caption)}
          >
            <span {...stylex.props(styles.targetLabel)}>{t('collect.saveTo')}</span>
            <FolderRegular {...stylex.props(styles.footerIcon)} />
            <span {...stylex.props(utility.truncate, weight.semibold)}>
              {current?.name ?? (folders.length === 0 ? t('collect.noFolders') : t('collect.pickFolder'))}
            </span>
            <DownRegular {...stylex.props(styles.footerIcon, styles.muted)} />
          </button>
        )}
      />
      <IconButton
        label={t('collect.openFolder')}
        icon={FolderOpenRegular}
        disabled={!current}
        onClick={() => current && void openPath(current.path)}
      />
    </div>
  )
}

/**
 * The panel under the menu bar icon: where a picture dragged from a web page
 * is dropped to be collected, and the pictures dropped so far. The Go side
 * takes the drop itself (see collect_darwin.go) and says when one is over.
 */
export function CollectPanel() {
  const { t } = useTranslation()
  const [items, setItems] = useState<CollectItem[]>([])
  const [over, setOver] = useState(false)

  useEffect(() => {
    void GoApp.collectedItems().then(setItems)
    const offItems = events.collectChanged.on(setItems)
    const offHover = events.collectHover.on(setOver)
    return () => {
      offItems()
      offHover()
    }
  }, [])

  return (
    <div {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.dropZone, over && styles.dropZoneOver)}>
        <DownloadRegular {...stylex.props(styles.dropIcon)} />
        <span {...stylex.props(text.caption, weight.semibold)}>
          {over ? t('collect.release') : t('collect.dropHere')}
        </span>
      </div>
      <div {...stylex.props(styles.list)}>
        {items.map(item => <Item key={item.id} item={item} />)}
      </div>
      <SaveTarget />
    </div>
  )
}
