import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useAtom } from 'jotai'
import { AnimatePresence, motion } from 'motion/react'
import type { RefObject } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { DeleteConfirmRequest } from '~/atoms/gallery'
import { deleteConfirmRequestAtom } from '~/atoms/gallery'
import { Button } from '~/components/Button'
import { thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'
import { cn } from '~/lib/cn'
import { cellsInRange, layoutMasonry } from '~/lib/masonry'
import { spring } from '~/lib/springs'
import { dialogBackdrop, dialogPopup } from '~/lib/surface'
import type { Photo } from '~/types/photo'
import BackRegular from '~icons/mingcute/back-line'
import CloudRegular from '~icons/mingcute/cloud-line'

const MIN_COLUMN_WIDTH = 140
const GUTTER = 8

// Revealed while the tile is hovered or the button has keyboard focus.
const revealedClass =
  'opacity-0 transition-opacity duration-80 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100'

function DeleteConfirmTile({
  photo,
  folderPath,
  width,
  height,
  onRemove,
}: {
  photo: Photo
  folderPath: string
  width: number
  height: number
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const thumbnailUrl = useThumbnail(folderPath, photo.path, thumbnailEdgeFor(width), true, photo.isCloudPlaceholder)

  return (
    <div className="group/tile relative overflow-hidden rounded-sm bg-fill" style={{ width, height }}>
      {photo.isCloudPlaceholder && !thumbnailUrl ? (
        <div className="flex size-full items-center justify-center text-text-secondary">
          <CloudRegular height={20} width={20} />
        </div>
      ) : (
        thumbnailUrl && (
          <img
            alt={photo.fileName}
            className="size-full object-cover"
            decoding="async"
            draggable={false}
            src={thumbnailUrl}
          />
        )
      )}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-center text-caption text-white/90',
          revealedClass,
        )}
      >
        {photo.fileName}
      </div>
      <button
        aria-label={t('deleteConfirm.keep', { name: photo.fileName })}
        title={t('deleteConfirm.keepTitle')}
        type="button"
        className={cn(
          'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 p-0 text-white hover:bg-black/80 focus-visible:outline-2',
          revealedClass,
        )}
        onClick={onRemove}
      >
        <BackRegular height={14} width={14} />
      </button>
    </div>
  )
}

/** The photos still marked for deletion, as a scrollable, windowed masonry grid. */
function DeleteConfirmGrid({
  photos,
  folderPath,
  onRemove,
}: {
  photos: Photo[]
  folderPath: string
  onRemove: (photo: Photo) => void
}) {
  const { t } = useTranslation()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
      setViewport({ top: el.scrollTop, height: el.clientHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(
    () =>
      layoutMasonry(
        photos.map((p) => p.aspectRatio),
        width,
        MIN_COLUMN_WIDTH,
        GUTTER,
      ),
    [photos, width],
  )
  // A screen above and below the visible part stays mounted, as in the main grid.
  const visible = cellsInRange(layout.cells, viewport.top - viewport.height, viewport.top + viewport.height * 2)

  return (
    <div
      onScroll={(e) => setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
      ref={scrollerRef}
      // The masonry scrolls on its own, so the header and buttons stay put.
      className="min-h-40 grow overflow-y-auto px-5 py-1"
    >
      {photos.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-body text-text-secondary">
          {t('deleteConfirm.nothingLeft')}
        </div>
      ) : (
        <div className="relative" style={{ height: layout.height }}>
          {/* Tiles glide into the gaps left by removed ones. */}
          <AnimatePresence initial={false}>
            {width > 0 &&
              visible.map((i) => {
                const photo = photos[i]
                const cell = layout.cells[i]
                return (
                  <motion.div
                    animate={{ opacity: 1, scale: 1, x: cell.left, y: cell.top }}
                    className="absolute top-0 left-0"
                    exit={{ opacity: 0, scale: 0.96, transition: spring.moderate.exit }}
                    initial={{ opacity: 0, scale: 0.96, x: cell.left, y: cell.top }}
                    key={photo.id}
                    transition={spring.moderate}
                  >
                    <DeleteConfirmTile
                      folderPath={folderPath}
                      height={cell.height}
                      photo={photo}
                      width={layout.columnWidth}
                      onRemove={() => onRemove(photo)}
                    />
                  </motion.div>
                )
              })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function DeleteConfirmContent({
  request,
  cancelRef,
  onClose,
}: {
  request: DeleteConfirmRequest
  cancelRef: RefObject<HTMLButtonElement | null>
  onClose: (photos: Photo[] | null) => void
}) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(request.photos)
  // Starts over when a new request reuses the mounted popup.
  const [prevRequest, setPrevRequest] = useState(request)
  if (request !== prevRequest) {
    setPrevRequest(request)
    setRemaining(request.photos)
  }

  return (
    <>
      <div className="flex flex-col gap-1 px-5 pt-5 pb-3">
        <AlertDialog.Title className="wght-semibold text-title">
          {t('common.deletePhotos', { count: remaining.length })}
        </AlertDialog.Title>
      </div>
      <DeleteConfirmGrid
        folderPath={request.folderPath}
        photos={remaining}
        onRemove={(photo) => setRemaining((prev) => prev.filter((p) => p.id !== photo.id))}
      />
      <div className="flex justify-end gap-2 px-5 pt-3 pb-5">
        <AlertDialog.Close ref={cancelRef} render={<Button variant="tertiary" />}>
          {t('common.cancel')}
        </AlertDialog.Close>
        <Button disabled={remaining.length === 0} variant="destructive" onClick={() => onClose(remaining)}>
          {t('deleteConfirm.confirm')}
        </Button>
      </div>
    </>
  )
}

/** Final confirmation for deleting photos, one or many, answering `deleteConfirmRequestAtom`. */
export function DeleteConfirmDialog() {
  const [request, setRequest] = useAtom(deleteConfirmRequestAtom)
  // Focus starts on the harmless choice, not the first tile's remove button.
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Keeps the last request on screen while the popup animates out.
  const [shown, setShown] = useState(request)
  if (request && request !== shown) setShown(request)

  const close = (photos: Photo[] | null) => {
    request?.resolve(photos)
    setRequest(null)
  }

  return (
    <AlertDialog.Root
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) close(null)
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setShown(null)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={dialogBackdrop} />
        <AlertDialog.Popup
          className={cn(dialogPopup, 'max-h-[calc(100vh-96px)] w-[min(880px,calc(100vw-64px))]')}
          initialFocus={cancelRef}
        >
          {shown && <DeleteConfirmContent cancelRef={cancelRef} request={shown} onClose={close} />}
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
