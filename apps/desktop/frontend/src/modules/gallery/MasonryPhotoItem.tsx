import type { ContextMenuItem } from '~/components/ContextMenu'
import type { Photo } from '~/types/photo'
import { CloudRegular, CopyRegular, Delete2Regular, EditRegular, LoadingRegular, MoveRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo } from 'react'
import {
  bulkDeleteBlockedAtom,
  filteredPhotosAtom,
  gridTabStopIdAtom,
  previewPhotoIdAtom,
  renamingPhotoIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { infoSidebarCollapsedAtom } from '~/atoms/layout'
import { Button } from '~/components/Button'
import { ContextMenu } from '~/components/ContextMenu'
import { useDeletePhoto } from '~/hooks/useDeletePhoto'
import { downloadingIdsAtom, useDownloadPlaceholder } from '~/hooks/useDownloadPlaceholder'
import { useMovePhotos } from '~/hooks/useMovePhotos'
import { thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'
import { writeText } from '~/lib/native'
import { colors } from '~/theme/colors.stylex'
import { motion } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'
import { tileMarker } from './markers.stylex'

interface MasonryPhotoItemProps {
  data: Photo
  width: number
  folderPath: string | null
}

const pulse = stylex.keyframes({
  '50%': { opacity: 0.5 },
})

const styles = stylex.create({
  item: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors['--ps-muted'],
    transitionProperty: 'box-shadow',
    transitionDuration: motion.fast,
  },
  focusRing: {
    outline: { 'default': 'none', ':focus-visible': `2px solid ${colors['--ps-focus-ring']}` },
    outlineOffset: 6,
  },
  // Focus follows the selection, whose ring already marks the tile.
  noFocusRing: { outline: 'none' },
  size: (width: number, height: number) => ({ width, height }),
  // A 2px gap in the page color, then a 2px ring when selected.
  selected: {
    boxShadow: `0 0 0 2px ${colors['--ps-background']}, 0 0 0 4px ${colors['--ps-foreground']}`,
  },
  unselected: {
    boxShadow: `0 0 0 2px ${colors['--ps-background']}, 0 0 0 4px transparent`,
  },
  placeholder: {
    display: 'flex',
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    color: colors['--ps-muted-foreground'],
  },
  // Above the hover overlay, which would otherwise swallow the click.
  aboveOverlay: { position: 'relative', zIndex: 1 },
  fill: { width: '100%', height: '100%' },
  cover: { objectFit: 'cover' },
  loading: {
    backgroundColor: colors['--ps-active'],
    animationName: pulse,
    animationDuration: '2s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)',
    animationIterationCount: 'infinite',
  },
  // Revealed while the tile is hovered.
  overlay: {
    position: 'absolute',
    insetInline: 0,
    bottom: 0,
    opacity: {
      default: 0,
      [stylex.when.ancestor(':hover', tileMarker)]: 1,
      [stylex.when.ancestor(':focus-within', tileMarker)]: 1,
    },
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
  },
  // The file name on a gradient, so it stays legible on any photo.
  infoOverlay: {
    display: 'flex',
    justifyContent: 'center',
    paddingInline: 8,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundImage: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)',
  },
  fileName: { maxWidth: '100%', pointerEvents: 'none', color: 'rgb(255 255 255 / 0.9)' },
  ratingBadge: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 6,
    backgroundColor: 'rgb(0 0 0 / 0.6)',
    paddingInline: 4,
    paddingBlock: 2,
    color: colors['--ps-rating'],
  },
})

/** The context menu's delete item, for `count` photos. */
function deleteLabel(count: number, bulkDeleteBlocked: boolean) {
  if (count === 1)
    return '删除'
  return bulkDeleteBlocked ? '缩略图生成中，暂不能批量删除' : `删除 ${count} 张照片`
}

/**
 * Selects a tile tabbed onto, so the keys that act on the selection (Space,
 * 0-5, Delete) act on the focused photo. A click's focus is left to the
 * click, which may be a ⌘/⇧ one; so is a button's inside the tile.
 */
function selectOnKeyboardFocus(e: React.FocusEvent<HTMLElement>, selected: boolean, select: () => void) {
  if (!selected && e.target === e.currentTarget && e.currentTarget.matches(':focus-visible'))
    select()
}

function MasonryPhotoItemInner({ data, width, folderPath }: MasonryPhotoItemProps) {
  // Cloud placeholders (undownloaded iCloud Drive files) never get a
  // thumbnail request - decoding them would force a synchronous download.
  const maxEdge = thumbnailEdgeFor(width)
  const thumbnailUrl = useThumbnail(folderPath, data.path, maxEdge, !data.isCloudPlaceholder)
  const deletePhoto = useDeletePhoto(folderPath)
  const movePhotos = useMovePhotos(folderPath)
  const downloadPlaceholder = useDownloadPlaceholder(folderPath)
  const downloading = useAtomValue(downloadingIdsAtom).has(data.id)
  // Read selection here (rather than taking it as a prop) so a selection
  // change re-renders only the tiles whose state changed, not the grid.
  const [selectedIds, setSelectedIds] = useAtom(selectedPhotoIdsAtom)
  const [anchorId, setAnchorId] = useAtom(selectedPhotoIdAtom)
  const photos = useAtomValue(filteredPhotosAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  const bulkDeleteBlocked = useAtomValue(bulkDeleteBlockedAtom)
  const setInfoCollapsed = useSetAtom(infoSidebarCollapsedAtom)
  const setRenamingId = useSetAtom(renamingPhotoIdAtom)
  const selected = selectedIds.has(data.id)
  const height = width / data.aspectRatio
  const isTabStop = useAtomValue(gridTabStopIdAtom) === data.id

  const handleSelect = (e: React.MouseEvent) => {
    // Selecting something is asking to see its details.
    setInfoCollapsed(false)
    if (e.shiftKey && anchorId) {
      const anchorIndex = photos.findIndex(p => p.id === anchorId)
      const clickedIndex = photos.findIndex(p => p.id === data.id)
      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const [start, end]
          = anchorIndex < clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex]
        setSelectedIds(new Set(photos.slice(start, end + 1).map(p => p.id)))
        return
      }
    }

    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(data.id))
          next.delete(data.id)
        else next.add(data.id)
        return next
      })
      setAnchorId(data.id)
      return
    }

    setSelectedIds(new Set([data.id]))
    setAnchorId(data.id)
  }

  const selectedCount = selected ? selectedIds.size : 1
  const targets = () => (selected ? photos.filter(p => selectedIds.has(p.id)) : [data])
  const openPreview = () => {
    if (!data.isCloudPlaceholder)
      setPreviewId(data.id)
  }
  const handleDelete = () => void deletePhoto(targets())
  const handleMove = () => void movePhotos(targets())

  // Renaming happens in the info panel, which the selection already shows.
  const handleRename = () => {
    setInfoCollapsed(false)
    setRenamingId(data.id)
  }

  const menuItems: ContextMenuItem[] = [
    ...(selectedCount === 1
      ? [
          { label: '重命名', icon: EditRegular, onSelect: handleRename },
          { label: '复制路径', icon: CopyRegular, onSelect: () => void writeText(data.path) },
        ]
      : []),
    {
      label: selectedCount > 1 ? `移动 ${selectedCount} 张照片到…` : '移动到…',
      icon: MoveRegular,
      onSelect: handleMove,
    },
    {
      label: deleteLabel(selectedCount, bulkDeleteBlocked),
      icon: Delete2Regular,
      destructive: true,
      disabled: selectedCount > 1 && bulkDeleteBlocked,
      onSelect: handleDelete,
    },
  ]

  return (
    <ContextMenu
      items={menuItems}
      onOpenChange={(open) => {
        if (open && !selectedIds.has(data.id)) {
          setInfoCollapsed(false)
          setSelectedIds(new Set([data.id]))
          setAnchorId(data.id)
        }
      }}
    >
      <div
        {...stylex.props(
          tileMarker,
          styles.item,
          styles.focusRing,
          selected ? styles.selected : styles.unselected,
          selected && styles.noFocusRing,
          styles.size(width, height),
        )}
        role="option"
        tabIndex={isTabStop ? 0 : -1}
        aria-selected={selected}
        aria-label={data.fileName}
        data-photo-id={data.id}
        onClick={handleSelect}
        onFocus={e => selectOnKeyboardFocus(e, selected, () => {
          setSelectedIds(new Set([data.id]))
          setAnchorId(data.id)
        })}
        onKeyDown={(e) => {
          // Keys pressed on a button inside (iCloud download) belong to it.
          if (e.target !== e.currentTarget)
            return
          // Space (preview) is handled for the whole grid in useGridShortcuts.
          if (e.key === 'Enter')
            openPreview()
        }}
        onDoubleClick={openPreview}
      >
        {data.isCloudPlaceholder
          ? (
              <div {...stylex.props(styles.placeholder)}>
                <CloudRegular size={20} />
                <span {...stylex.props(text.caption)}>iCloud 未下载</span>
                <Button
                  variant="secondary"
                  size="compact"
                  xstyle={styles.aboveOverlay}
                  leadingIcon={downloading ? LoadingRegular : undefined}
                  disabled={downloading}
                  onClick={(e) => {
                    e.stopPropagation()
                    void downloadPlaceholder(data)
                  }}
                >
                  {downloading ? '下载中' : '下载'}
                </Button>
              </div>
            )
          : thumbnailUrl
            ? (
                <img
                  src={thumbnailUrl}
                  alt={data.fileName}
                  decoding="async"
                  {...stylex.props(styles.fill, styles.cover)}
                  draggable={false}
                />
              )
            : (
                <div {...stylex.props(styles.fill, styles.loading)} />
              )}
        <div {...stylex.props(styles.overlay, styles.infoOverlay)}>
          <span {...stylex.props(utility.truncate, styles.fileName, text.caption)}>
            {data.fileName}
          </span>
        </div>
        {data.rating > 0 && (
          <div {...stylex.props(styles.ratingBadge, text.caption, weight.semibold)}>
            {data.rating}
            ★
          </div>
        )}
      </div>
    </ContextMenu>
  )
}

export const MasonryPhotoItem = memo(MasonryPhotoItemInner)
