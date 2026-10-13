import type { RefObject } from 'react'
import type { DeleteConfirmRequest } from '~/atoms/gallery'
import type { Photo } from '~/types/photo'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { CloseRegular, CloudRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { deleteConfirmRequestAtom } from '~/atoms/gallery'
import { Button } from '~/components/Button'
import { SurfaceProvider } from '~/context/surface'
import { thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'
import { cellsInRange, layoutMasonry } from '~/lib/masonry'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { motion as motionTokens, radius } from '~/theme/layout.stylex'
import { surfaceStyles } from '~/theme/surface'
import { text, utility, weight } from '~/theme/text'
import { tileMarker } from './markers.stylex'

const MIN_COLUMN_WIDTH = 140
const GUTTER = 8
const SURFACE_LEVEL = 3

const hidden = ':is([data-starting-style], [data-ending-style])'

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    backgroundColor: 'rgb(0 0 0 / 0.4)',
    opacity: { default: 1, [hidden]: 0 },
    transitionProperty: 'opacity',
    transitionDuration: '150ms',
  },
  popup: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    width: 'min(880px, calc(100vw - 64px))',
    maxHeight: 'calc(100vh - 96px)',
    borderRadius: radius.container,
    outline: 'none',
    opacity: { default: 1, [hidden]: 0 },
    transform: {
      default: 'translate(-50%, -50%)',
      [hidden]: 'translate(-50%, -50%) scale(0.97)',
    },
    transitionProperty: 'opacity, transform',
    transitionDuration: '150ms',
    transitionTimingFunction: motionTokens.easeOut,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingInline: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  description: { color: colors['--ps-muted-foreground'] },
  // The masonry scrolls on its own, so the header and buttons stay put.
  scroller: {
    flexGrow: 1,
    minHeight: 160,
    overflowY: 'auto',
    paddingInline: 20,
    paddingBlock: 4,
  },
  grid: { position: 'relative' },
  gridHeight: (height: number) => ({ height }),
  cell: { position: 'absolute', top: 0, left: 0 },
  empty: {
    display: 'flex',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    color: colors['--ps-muted-foreground'],
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingInline: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },

  tile: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors['--ps-muted'],
  },
  size: (width: number, height: number) => ({ width, height }),
  fill: { width: '100%', height: '100%', objectFit: 'cover' },
  placeholder: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors['--ps-muted-foreground'],
  },
  fileName: {
    position: 'absolute',
    insetInline: 0,
    bottom: 0,
    paddingInline: 8,
    paddingTop: 16,
    paddingBottom: 6,
    textAlign: 'center',
    pointerEvents: 'none',
    color: 'rgb(255 255 255 / 0.9)',
    backgroundImage: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)',
  },
  // Revealed while the tile is hovered or the button has keyboard focus.
  revealed: {
    opacity: {
      default: 0,
      [stylex.when.ancestor(':hover', tileMarker)]: 1,
      [stylex.when.ancestor(':focus-within', tileMarker)]: 1,
    },
    transitionProperty: 'opacity',
    transitionDuration: motionTokens.fast,
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    display: 'flex',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    borderWidth: 0,
    borderRadius: radius.full,
    backgroundColor: { 'default': 'rgb(0 0 0 / 0.6)', ':hover': 'rgb(0 0 0 / 0.8)' },
    color: 'white',
    outline: { 'default': 'none', ':focus-visible': `2px solid ${colors['--ps-focus-ring']}` },
  },
})

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
  const thumbnailUrl = useThumbnail(folderPath, photo.path, thumbnailEdgeFor(width), !photo.isCloudPlaceholder)

  return (
    <div {...stylex.props(tileMarker, styles.tile, styles.size(width, height))}>
      {photo.isCloudPlaceholder
        ? (
            <div {...stylex.props(styles.placeholder)}>
              <CloudRegular size={20} />
            </div>
          )
        : thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={photo.fileName}
            decoding="async"
            draggable={false}
            {...stylex.props(styles.fill)}
          />
        )}
      <div {...stylex.props(styles.fileName, styles.revealed, utility.truncate, text.caption)}>
        {photo.fileName}
      </div>
      <button
        type="button"
        aria-label={`不删除「${photo.fileName}」`}
        title="不删除这张"
        {...stylex.props(styles.remove, styles.revealed)}
        onClick={onRemove}
      >
        <CloseRegular size={14} />
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el)
      return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
      setViewport({ top: el.scrollTop, height: el.clientHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(
    () => layoutMasonry(photos.map(p => p.aspectRatio), width, MIN_COLUMN_WIDTH, GUTTER),
    [photos, width],
  )
  // A screen above and below the visible part stays mounted, as in the main grid.
  const visible = cellsInRange(layout.cells, viewport.top - viewport.height, viewport.top + viewport.height * 2)

  return (
    <div
      ref={scrollerRef}
      {...stylex.props(styles.scroller)}
      onScroll={e => setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
    >
      {photos.length === 0
        ? <div {...stylex.props(styles.empty, text.body)}>没有要删除的照片了</div>
        : (
            <div {...stylex.props(styles.grid, styles.gridHeight(layout.height))}>
              {/* Tiles glide into the gaps left by removed ones. */}
              <AnimatePresence initial={false}>
                {width > 0 && visible.map((i) => {
                  const photo = photos[i]
                  const cell = layout.cells[i]
                  return (
                    <motion.div
                      key={photo.id}
                      {...stylex.props(styles.cell)}
                      initial={{ opacity: 0, scale: 0.96, x: cell.left, y: cell.top }}
                      animate={{ opacity: 1, scale: 1, x: cell.left, y: cell.top }}
                      exit={{ opacity: 0, scale: 0.96, transition: spring.moderate.exit }}
                      transition={spring.moderate}
                    >
                      <DeleteConfirmTile
                        photo={photo}
                        folderPath={folderPath}
                        width={layout.columnWidth}
                        height={cell.height}
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
  const [remaining, setRemaining] = useState(request.photos)
  // Starts over when a new request reuses the mounted popup.
  const [prevRequest, setPrevRequest] = useState(request)
  if (request !== prevRequest) {
    setPrevRequest(request)
    setRemaining(request.photos)
  }

  return (
    <>
      <div {...stylex.props(styles.header)}>
        <AlertDialog.Title {...stylex.props(text.title, weight.semibold)}>
          {`删除 ${remaining.length} 张照片`}
        </AlertDialog.Title>
        <AlertDialog.Description {...stylex.props(styles.description, text.body)}>
          这些照片将被移到废纸篓。点击照片右上角的 × 可以把它从本次删除中移出。
        </AlertDialog.Description>
      </div>
      <DeleteConfirmGrid
        photos={remaining}
        folderPath={request.folderPath}
        onRemove={photo => setRemaining(prev => prev.filter(p => p.id !== photo.id))}
      />
      <div {...stylex.props(styles.footer)}>
        <AlertDialog.Close ref={cancelRef} render={<Button variant="tertiary" />}>取消</AlertDialog.Close>
        <Button
          variant="destructive"
          disabled={remaining.length === 0}
          onClick={() => onClose(remaining)}
        >
          确认删除
        </Button>
      </div>
    </>
  )
}

/** Final confirmation for deleting several photos, answering `deleteConfirmRequestAtom`. */
export function DeleteConfirmDialog() {
  const [request, setRequest] = useAtom(deleteConfirmRequestAtom)
  // Focus starts on the harmless choice, not the first tile's remove button.
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Keeps the last request on screen while the popup animates out.
  const [shown, setShown] = useState(request)
  if (request && request !== shown)
    setShown(request)

  const close = (photos: Photo[] | null) => {
    request?.resolve(photos)
    setRequest(null)
  }

  return (
    <AlertDialog.Root
      open={request !== null}
      onOpenChange={(open) => {
        if (!open)
          close(null)
      }}
      onOpenChangeComplete={(open) => {
        if (!open)
          setShown(null)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop {...stylex.props(styles.backdrop)} />
        <SurfaceProvider value={SURFACE_LEVEL}>
          <AlertDialog.Popup initialFocus={cancelRef} {...stylex.props(styles.popup, ...surfaceStyles(SURFACE_LEVEL, 8))}>
            {shown && <DeleteConfirmContent request={shown} cancelRef={cancelRef} onClose={close} />}
          </AlertDialog.Popup>
        </SurfaceProvider>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
