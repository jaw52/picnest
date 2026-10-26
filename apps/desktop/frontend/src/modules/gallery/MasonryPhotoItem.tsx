import type { TFunction } from 'i18next'
import { atom, useAtomValue, useSetAtom, useStore } from 'jotai'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
import type { ContextMenuItem } from '~/components/ContextMenu'
import { ContextMenu } from '~/components/ContextMenu'
import { IconButton } from '~/components/IconButton'
import { useDeletePhoto } from '~/hooks/useDeletePhoto'
import { downloadingIdsAtom, useDownloadPlaceholder } from '~/hooks/useDownloadPlaceholder'
import { useFileName } from '~/hooks/useFileName'
import { useMovePhotos } from '~/hooks/useMovePhotos'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { largestCachedThumbnail, thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'
import { cn } from '~/lib/cn'
import { isLibraryPath } from '~/lib/library'
import { writeText } from '~/lib/native'
import type { Photo } from '~/types/photo'
import CloudRegular from '~icons/mingcute/cloud-line'
import CopyRegular from '~icons/mingcute/copy-line'
import Delete2Regular from '~icons/mingcute/delete-2-line'
import EditRegular from '~icons/mingcute/edit-line'
import InformationRegular from '~icons/mingcute/information-line'
import LoadingRegular from '~icons/mingcute/loading-line'
import MoveRegular from '~icons/mingcute/move-line'

import { TileCaption } from './TileCaption'

interface MasonryPhotoItemProps {
  /** Ask for the thumbnail behind tiles on screen (see useThumbnail). */
  background: boolean
  data: Photo
  folderPath: string | null
  width: number
}

/** The context menu's delete item, for `count` photos. */
function deleteLabel(t: TFunction, count: number, bulkDeleteBlocked: boolean) {
  if (count === 1) return t('common.delete')
  return bulkDeleteBlocked ? t('gallery.bulkDeleteBusy') : t('common.deletePhotos', { count })
}

/**
 * Selects a tile tabbed onto, so the keys that act on the selection (Space,
 * 0-5, Delete) act on the focused photo. A click's focus is left to the
 * click, which may be a ⌘/⇧ one; so is a button's inside the tile.
 */
function selectOnKeyboardFocus(e: React.FocusEvent<HTMLElement>, selected: boolean, select: () => void) {
  if (!selected && e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) select()
}

/**
 * The tile's picture: the thumbnail, iCloud's thumbnail with a download
 * button for an undownloaded file, or a "not downloaded" tile if iCloud has
 * none.
 */
function TileImage({
  photo,
  fileName,
  thumbnailUrl,
  folderPath,
}: {
  photo: Photo
  fileName: string
  thumbnailUrl: string | undefined
  folderPath: string | null
}) {
  const { t } = useTranslation()
  const downloadPlaceholder = useDownloadPlaceholder(folderPath)
  const downloading = useAtomValue(downloadingIdsAtom).has(photo.id)
  const download = (e: React.MouseEvent) => {
    e.stopPropagation()
    void downloadPlaceholder(photo)
  }
  const downloadLabel = downloading ? t('gallery.downloading') : t('gallery.download')

  const image = thumbnailUrl ? (
    <img alt={fileName} className="size-full object-cover" decoding="async" draggable={false} src={thumbnailUrl} />
  ) : null
  if (!photo.isCloudPlaceholder) return image ?? <div className="size-full animate-pulse bg-text/10" />
  if (image) {
    return (
      <>
        {image}
        {/* The download button over an undownloaded file's iCloud thumbnail. */}
        <div className="absolute top-1.5 left-1.5 z-1">
          <IconButton
            disabled={downloading}
            icon={downloading ? LoadingRegular : CloudRegular}
            label={downloadLabel}
            variant="secondary"
            onClick={download}
          />
        </div>
      </>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-text-secondary">
      <CloudRegular height={20} width={20} />
      <span className="text-caption">{t('gallery.notDownloaded')}</span>
      {/* Above the hover overlay, which would otherwise swallow the click. */}
      <Button
        className="relative z-1"
        disabled={downloading}
        leadingIcon={downloading ? LoadingRegular : undefined}
        variant="secondary"
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
  const thumbnailUrl =
    useThumbnail(folderPath, data.path, maxEdge, true, data.isCloudPlaceholder, background) ??
    largestCachedThumbnail(folderPath, data.path)
  const fileName = useFileName(data)
  const deletePhoto = useDeletePhoto(folderPath)
  const movePhotos = useMovePhotos(folderPath)
  const rate = useRatePhoto(folderPath)
  const store = useStore()
  // Read selection here (rather than taking it as a prop) so a selection
  // change re-renders only the tiles whose state changed, not the grid: each
  // tile subscribes to values of its own, which only change for it. The
  // photos and the whole selection are read when needed, in the handlers.
  const { selectionSize, isTabStop: isTabStopAtom } = useMemo(
    () => ({
      // How many photos are selected, if this one is; else 0.
      selectionSize: atom((get) => (get(selectedPhotoIdsAtom).has(data.id) ? get(selectedPhotoIdsAtom).size : 0)),
      isTabStop: atom((get) => get(gridTabStopIdAtom) === data.id),
    }),
    [data.id],
  )
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const setAnchorId = useSetAtom(selectedPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  const bulkDeleteBlocked = useAtomValue(bulkDeleteBlockedAtom)
  const setRenamingId = useSetAtom(renamingPhotoIdAtom)
  const setInfoId = useSetAtom(photoInfoIdAtom)
  const size = useAtomValue(selectionSize)
  const selected = size > 0
  const height = width / data.aspectRatio
  const isTabStop = useAtomValue(isTabStopAtom)

  const handleSelect = (e: React.MouseEvent) => {
    const anchorId = store.get(selectedPhotoIdAtom)
    if (e.shiftKey && anchorId) {
      const photos = store.get(filteredPhotosAtom)
      const anchorIndex = photos.findIndex((p) => p.id === anchorId)
      const clickedIndex = photos.findIndex((p) => p.id === data.id)
      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const [start, end] = anchorIndex < clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex]
        setSelectedIds(new Set(photos.slice(start, end + 1).map((p) => p.id)))
        return
      }
    }

    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(data.id)) next.delete(data.id)
        else next.add(data.id)
        return next
      })
      setAnchorId(data.id)
      return
    }

    setSelectedIds(new Set([data.id]))
    setAnchorId(data.id)
  }

  const selectedCount = Math.max(size, 1)
  const targets = () => {
    const selectedIds = store.get(selectedPhotoIdsAtom)
    return selected ? store.get(filteredPhotosAtom).filter((p) => selectedIds.has(p.id)) : [data]
  }
  const openPreview = () => setPreviewId(data.id)
  const handleDelete = () => void deletePhoto(targets())
  const handleMove = () => void movePhotos(targets())

  // After the menu has closed and handed focus back, so the card's name
  // field keeps it.
  const openInfo = () => setTimeout(setInfoId, 0, data.id)
  // Renaming happens in the info card.
  const handleRename = () => {
    setRenamingId(data.id)
    openInfo()
  }

  // Photos in the Photos library aren't files of their own to rename or
  // move.
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
        ]
      : []),
    {
      label: deleteLabel(t, selectedCount, bulkDeleteBlocked),
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
        if (!open || store.get(selectedPhotoIdsAtom).has(data.id)) {
          return
        }

        setSelectedIds(new Set([data.id]))
        setAnchorId(data.id)
      }}
    >
      <div
        // Focus follows the selection, whose border already marks the tile.
        aria-label={fileName}
        aria-selected={selected}
        data-photo-id={data.id}
        role="option"
        style={{ width, height }}
        tabIndex={isTabStop ? 0 : -1}
        className={cn(
          'group/tile relative overflow-hidden rounded-sm bg-fill outline-offset-6',
          selected ? 'outline-none' : 'focus-visible:outline-2',
        )}
        onClick={handleSelect}
        onDoubleClick={openPreview}
        onFocus={(e) =>
          selectOnKeyboardFocus(e, selected, () => {
            setSelectedIds(new Set([data.id]))
            setAnchorId(data.id)
          })
        }
        onKeyDown={(e) => {
          // Keys pressed on a button inside (iCloud download) belong to it.
          if (e.target !== e.currentTarget) return
          // Space (preview) is handled for the whole grid in useGridShortcuts.
          if (e.key === 'Enter') openPreview()
        }}
      >
        <TileImage fileName={fileName} folderPath={folderPath} photo={data} thumbnailUrl={thumbnailUrl} />
        {/* Like digiKam and Eagle: an accent border and a faint accent wash over
         * the picture. */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-sm bg-accent/20 inset-ring-3 inset-ring-accent transition-opacity duration-80',
            selected ? 'opacity-100' : 'opacity-0',
          )}
        />
        <TileCaption photo={data} onRate={(r) => rate([data], r)} />
        {data.rating > 0 && (
          // Gives way to the caption's rating button, which shows the same.
          <div className="wght-semibold pointer-events-none absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1 py-0.5 text-caption text-amber transition-opacity duration-80 group-focus-within/tile:opacity-0 group-hover/tile:opacity-0">
            {data.rating}★
          </div>
        )}
      </div>
    </ContextMenu>
  )
}

export const MasonryPhotoItem = memo(MasonryPhotoItemInner)
