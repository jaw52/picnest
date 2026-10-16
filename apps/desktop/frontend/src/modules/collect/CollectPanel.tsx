import type { CollectItem } from '~/mygo'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckCircleRegular from '~icons/mingcute/check-circle-line'
import CloseCircleRegular from '~icons/mingcute/close-circle-line'
import DownloadRegular from '~icons/mingcute/download-2-line'
import FolderOpenRegular from '~icons/mingcute/folder-open-line'
import LoadingRegular from '~icons/mingcute/loading-3-line'
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
    gap: 6,
    alignSelf: 'flex-start',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: { 'default': colors['--ps-muted-foreground'], ':hover': colors['--ps-foreground'] },
  },
  footerIcon: { width: 14, height: 14 },
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
      <button
        type="button"
        onClick={() => void GoApp.collectionPath().then(openPath)}
        {...stylex.props(styles.footer, text.caption)}
      >
        <FolderOpenRegular {...stylex.props(styles.footerIcon)} />
        {t('collect.openFolder')}
      </button>
    </div>
  )
}
