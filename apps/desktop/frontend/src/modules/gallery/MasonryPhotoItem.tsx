import type { TFunction } from 'i18next'
import type { ContextMenuItem } from '~/components/ContextMenu'
import type { Photo } from '~/types/photo'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import CloudRegular from '~icons/mingcute/cloud-line'
import CopyRegular from '~icons/mingcute/copy-line'
import Delete2Regular from '~icons/mingcute/delete-2-line'
import EditRegular from '~icons/mingcute/edit-line'
import InformationRegular from '~icons/mingcute/information-line'
import LoadingRegular from '~icons/mingcute/loading-line'
import MoveRegular from '~icons/mingcute/move-line'
import {
  bulkDeleteBlockedAtom,
  filteredPhotosAtom,
  gridTabStopIdAtom,
  photoInfoIdAtom,
  previewPhotoIdAtom,
  renamingPhotoIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { Button } from '~/components/Button'
import { ContextMenu } from '~/components/ContextMenu'
import { IconButton } from '~/components/IconButton'
import { useDeletePhoto } from '~/hooks/useDeletePhoto'
import { downloadingIdsAtom, useDownloadPlaceholder } from '~/hooks/useDownloadPlaceholder'
import { useMovePhotos } from '~/hooks/useMovePhotos'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { largestCachedThumbnail, thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'
import { isLibraryPath } from '~/lib/library'
import { writeText } from '~/lib/native'
import { colors } from '~/theme/colors.stylex'
import { motion } from '~/theme/layout.stylex'
import { text, weight } from '~/theme/text'
import { tileMarker } from './markers.stylex'
import { TileCaption } from './TileCaption'

interface MasonryPhotoItemProps {
  data: Photo
  width: number
  folderPath: string | null
  /** Ask for the thumbnail behind tiles on screen (see useThumbnail). */
  background: boolean
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
  // The download button over an undownloaded file's iCloud thumbnail.
  cloudBadge: {
    position: 'absolute',
    zIndex: 1,
    top: 6,
    left: 6,
  },
  fill: { width: '100%', height: '100%' },
  cover: { objectFit: 'cover' },
  loading: {
    backgroundColor: colors['--ps-active'],
    animationName: pulse,
    animationDuration: '2s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)',
    animationIterationCount: 'infinite',
  },
  // Gives way to the caption's rating button, which shows the same.
  ratingBadge: {
    pointerEvents: 'none',
    opacity: {
      default: 1,
      [stylex.when.ancestor(':hover', tileMarker)]: 0,
      [stylex.when.ancestor(':focus-within', tileMarker)]: 0,
    },
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
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
function deleteLabel(t: TFunction, count: number, bulkDeleteBlocked: boolean) {
  if (count === 1)
    return t('common.delete')
  return bulkDeleteBlocked ? t('gallery.bulkDeleteBusy') : t('common.deletePhotos', { count })
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

/**
 * The tile's picture: the thumbnail, iCloud's thumbnail with a download
 * button for an undownloaded file, or a "not downloaded" tile if iCloud has
 * none.
 */
function TileImage({ photo, thumbnailUrl, folderPath }: { photo: Photo, thumbnailUrl: string | undefined, folderPath: string | null }) {
  const { t } = useTranslation()
  const downloadPlaceholder = useDownloadPlaceholder(folderPath)
  const downloading = useAtomValue(downloadingIdsAtom).has(photo.id)
  const download = (e: React.MouseEvent) => {
    e.stopPropagation()
    void downloadPlaceholder(photo)
  }
  const downloadLabel = downloading ? t('gallery.downloading') : t('gallery.download')

  const image = thumbnailUrl && (
    <img
      src={thumbnailUrl}
      alt={photo.fileName}
      decoding="async"
      {...stylex.props(styles.fill, styles.cover)}
      draggable={false}
    />
  )
  if (!photo.isCloudPlaceholder)
    return image || <div {...stylex.props(styles.fill, styles.loading)} />
  if (image) {
    return (
      <>
        {image}
        <div {...stylex.props(styles.cloudBadge)}>
          <IconButton
            variant="secondary"
            label={downloadLabel}
            icon={downloading ? LoadingRegular : CloudRegular}
            disabled={downloading}
            onClick={download}
          />
        </div>
      </>
    )
  }
  return (
    <div {...stylex.props(styles.placeholder)}>
      <CloudRegular width={20} height={20} />
      <span {...stylex.props(text.caption)}>{t('gallery.notDownloaded')}</span>
      <Button
        variant="secondary"
        size="compact"
        xstyle={styles.aboveOverlay}
        leadingIcon={downloading ? LoadingRegular : undefined}
        disabled={downloading}
        onClick={download}
      >
        {downloadLabel}
      </Button>
    </div>
  )
}

function MasonryPhotoItemInner({ data, width, folderPath, background }: MasonryPhotoItemProps) {
  const { t } = useTranslation()
  // Undownloaded iCloud files get iCloud's own thumbnail, without a download.
  const maxEdge = thumbnailEdgeFor(width)
  // A thumbnail at another size, from before the tiles were resized, shows
  // until this size is ready.
  const thumbnailUrl = useThumbnail(folderPath, data.path, maxEdge, true, data.isCloudPlaceholder, background)
    ?? largestCachedThumbnail(folderPath, data.path)
  const deletePhoto = useDeletePhoto(folderPath)
  const movePhotos = useMovePhotos(folderPath)
  const rate = useRatePhoto(folderPath)
  // Read selection here (rather than taking it as a prop) so a selection
  // change re-renders only the tiles whose state changed, not the grid.
  const [selectedIds, setSelectedIds] = useAtom(selectedPhotoIdsAtom)
  const [anchorId, setAnchorId] = useAtom(selectedPhotoIdAtom)
  const photos = useAtomValue(filteredPhotosAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  const bulkDeleteBlocked = useAtomValue(bulkDeleteBlockedAtom)
  const setRenamingId = useSetAtom(renamingPhotoIdAtom)
  const setInfoId = useSetAtom(photoInfoIdAtom)
  const selected = selectedIds.has(data.id)
  const height = width / data.aspectRatio
  const isTabStop = useAtomValue(gridTabStopIdAtom) === data.id

  const handleSelect = (e: React.MouseEvent) => {
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
  const openPreview = () => setPreviewId(data.id)
  const handleDelete = () => void deletePhoto(targets())
  const handleMove = () => void movePhotos(targets())

  // After the menu has closed and handed focus back, so the card's name
  // field keeps it.
  const openInfo = () => setTimeout(() => setInfoId(data.id))
  // Renaming happens in the info card.
  const handleRename = () => {
    setRenamingId(data.id)
    openInfo()
  }

  // Photos in the Photos library aren't files of their own to rename, move
  // or delete.
  const isFile = !isLibraryPath(folderPath)
  const menuItems: ContextMenuItem[] = [
    ...(selectedCount === 1 ? [{ label: t('gallery.info'), icon: InformationRegular, onSelect: openInfo }] : []),
    ...(selectedCount === 1 && isFile
      ? [
          { label: t('gallery.rename'), icon: EditRegular, onSelect: handleRename },
          { label: t('common.copyPath'), icon: CopyRegular, onSelect: () => void writeText(data.path) },
        ]
      : []),
    ...(isFile
      ? [
          {
            label: selectedCount > 1 ? t('common.movePhotosTo', { count: selectedCount }) : t('gallery.moveTo'),
            icon: MoveRegular,
            onSelect: handleMove,
          },
          {
            label: deleteLabel(t, selectedCount, bulkDeleteBlocked),
            icon: Delete2Regular,
            destructive: true,
            disabled: selectedCount > 1 && bulkDeleteBlocked,
            onSelect: handleDelete,
          },
        ]
      : []),
  ]

  return (
    <ContextMenu
      items={menuItems}
      onOpenChange={(open) => {
        if (open && !selectedIds.has(data.id)) {
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
        <TileImage photo={data} thumbnailUrl={thumbnailUrl} folderPath={folderPath} />
        <TileCaption photo={data} onRate={r => rate([data], r)} />
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
