import type { LucideIcon } from 'lucide-react'
import type { MouseEvent, WheelEvent } from 'react'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { ChevronLeft, ChevronRight, Copy, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  currentFolderAtom,
  filteredPhotosAtom,
  previewPhotoAtom,
  previewPhotoIdAtom,
} from '~/atoms/gallery'
import { StarRating } from '~/components/StarRating'
import { Tooltip } from '~/components/Tooltip'
import { useDecodedImages } from '~/hooks/useDecodedImages'
import { useDeletePhoto } from '~/hooks/useDeletePhoto'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { convertFileSrc, writeText } from '~/lib/native'
import { ratingFromKey } from '~/lib/rating-key'
import { spring } from '~/lib/springs'
import { createSwipeDetector } from '~/lib/swipe'
import { motion as motionTokens, radius } from '~/theme/layout.stylex'
import { text } from '~/theme/text'
import { lightboxButtonMarker } from './markers.stylex'
import { ZoomableImage } from './ZoomableImage'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(0 0 0 / 0.9)',
    outline: 'none',
  },
  // A round control on the lightbox, which stays dark whatever the theme.
  button: {
    position: 'absolute',
    display: 'flex',
    width: 36,
    height: 36,
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: radius.full,
    backgroundColor: {
      'default': 'rgb(255 255 255 / 0.1)',
      ':hover': 'rgb(255 255 255 / 0.2)',
      ':active': 'rgb(255 255 255 / 0.25)',
    },
    color: { 'default': 'rgb(255 255 255 / 0.8)', ':hover': 'white' },
    transitionProperty: 'color, background-color',
    transitionDuration: motionTokens.fast,
  },
  close: { top: 16, right: 16 },
  prev: { top: '50%', left: 16, transform: 'translateY(-50%)' },
  next: { top: '50%', right: 16, transform: 'translateY(-50%)' },
  icon: {
    strokeWidth: { default: 1.5, [stylex.when.ancestor(':hover', lightboxButtonMarker)]: 2, [stylex.when.ancestor(':active', lightboxButtonMarker)]: 2 },
    transitionProperty: 'stroke-width',
    transitionDuration: motionTokens.fast,
  },
  notice: { margin: 'auto', color: 'rgb(255 255 255 / 0.8)' },
  caption: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    // As wide as its content, up to the window: a long file name gives way
    // (it ellipsizes) instead of squeezing the count onto two lines.
    width: 'max-content',
    maxWidth: 'calc(100% - 32px)',
    borderRadius: radius.item,
    backgroundColor: 'rgb(255 255 255 / 0.1)',
    paddingInline: 12,
    paddingBlock: 4,
    color: 'rgb(255 255 255 / 0.8)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  captionName: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  captionCount: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    color: 'rgb(255 255 255 / 0.6)',
  },
  captionRating: { display: 'flex', flexShrink: 0 },
})

type LightboxPosition = 'close' | 'prev' | 'next'

function LightboxButton({
  label,
  icon: Icon,
  position,
  onClick,
}: {
  label: string
  icon: LucideIcon
  position: LightboxPosition
  onClick: (e: MouseEvent) => void
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        {...stylex.props(lightboxButtonMarker, styles.button, styles[position])}
        onClick={onClick}
      >
        <Icon size={18} {...stylex.props(styles.icon)} />
      </button>
    </Tooltip>
  )
}

export function PhotoPreview() {
  const photos = useAtomValue(filteredPhotosAtom)
  const photo = useAtomValue(previewPhotoAtom)
  const [, setPreviewId] = useAtom(previewPhotoIdAtom)
  const folderPath = useAtomValue(currentFolderAtom)
  const deletePhoto = useDeletePhoto(folderPath)
  const rate = useRatePhoto(folderPath)

  // Move focus into the lightbox while it's open and hand it back to
  // whatever opened it (usually the tile) on close.
  const overlayRef = useRef<HTMLDivElement>(null)
  const isOpen = photo !== null
  useEffect(() => {
    if (!isOpen)
      return
    const opener = document.activeElement as HTMLElement | null
    overlayRef.current?.focus()
    return () => opener?.focus()
  }, [isOpen])

  // The lightbox fades its photo in when it opens, but swaps photos in place
  // after that: fading each one in would blink the backdrop through.
  const [openedId, setOpenedId] = useState<string | null>(null)
  if (!photo && openedId !== null)
    setOpenedId(null)
  if (photo && openedId === null)
    setOpenedId(photo.id)

  const index = photo ? photos.findIndex(p => p.id === photo.id) : -1

  // Neighbours are decoded in the background, and a switch waits for the next
  // photo to decode, so the current one stays up until the next can paint.
  const { decode, retain } = useDecodedImages()
  useEffect(() => {
    if (index === -1)
      return
    const srcs = [photos[index - 1], photos[index], photos[index + 1]]
      .filter(p => p && !p.isCloudPlaceholder)
      .map(p => convertFileSrc(p!.path))
    retain(srcs)
    for (const src of srcs)
      void decode(src)
  }, [index, photos, decode, retain])
  useEffect(() => {
    if (!isOpen)
      retain([])
  }, [isOpen, retain])

  // Only the latest switch lands, should several be waiting on decodes.
  const switchRef = useRef(0)
  const goTo = useCallback(
    (delta: number) => {
      if (index === -1)
        return
      const next = photos[index + delta]
      if (!next)
        return
      const token = ++switchRef.current
      const ready = next.isCloudPlaceholder ? Promise.resolve() : decode(convertFileSrc(next.path))
      void ready.then(() => {
        if (switchRef.current === token)
          setPreviewId(next.id)
      })
    },
    [index, photos, setPreviewId, decode],
  )

  // Two-finger horizontal swipe, one photo per gesture. Lives here rather
  // than in ZoomableImage because that remounts with every photo, which would
  // lose track of the gesture mid-momentum.
  const [swipe] = useState(createSwipeDetector)
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.ctrlKey)
      return
    const direction = swipe.push(e.deltaX, e.deltaY, e.timeStamp)
    if (direction !== 0)
      goTo(direction)
  }

  useEffect(() => {
    if (!photo)
      return
    const current = photo
    function onKeyDown(e: KeyboardEvent) {
      // Space closes it too, as Quick Look does in Finder.
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        if (!e.repeat)
          setPreviewId(null)
      }
      else if (e.key === 'ArrowLeft') {
        goTo(-1)
      }
      else if (e.key === 'ArrowRight') {
        goTo(1)
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (!e.repeat)
          void deletePhoto([current])
      }
      else {
        const rating = ratingFromKey(e)
        if (rating !== null)
          rate(current, rating)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [photo, goTo, setPreviewId, deletePhoto, rate])

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={photo.fileName}
          tabIndex={-1}
          {...stylex.props(styles.overlay)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: spring.slow.exit }}
          transition={spring.slow}
          onClick={() => setPreviewId(null)}
          onWheel={onWheel}
        >
          {photo.isCloudPlaceholder
            ? (
                <div {...stylex.props(styles.notice, text.body)}>iCloud 未下载，无法预览</div>
              )
            : (
                <ZoomableImage
                  key={photo.id}
                  src={convertFileSrc(photo.path)}
                  alt={photo.fileName}
                  fadeIn={photo.id === openedId}
                  menuItems={[
                    { label: '复制路径', icon: Copy, onSelect: () => void writeText(photo.path) },
                    {
                      label: '删除',
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => void deletePhoto([photo]),
                    },
                  ]}
                />
              )}
          <LightboxButton
            label="关闭"
            icon={X}
            position="close"
            onClick={() => setPreviewId(null)}
          />
          {index > 0 && (
            <LightboxButton
              label="上一张"
              icon={ChevronLeft}
              position="prev"
              onClick={(e) => {
                e.stopPropagation()
                goTo(-1)
              }}
            />
          )}
          {index !== -1 && index < photos.length - 1 && (
            <LightboxButton
              label="下一张"
              icon={ChevronRight}
              position="next"
              onClick={(e) => {
                e.stopPropagation()
                goTo(1)
              }}
            />
          )}
          <div {...stylex.props(styles.caption, text.caption)} onClick={e => e.stopPropagation()}>
            <span {...stylex.props(styles.captionName)}>{photo.fileName}</span>
            {index !== -1 && (
              <span {...stylex.props(styles.captionCount)}>{`${index + 1} / ${photos.length}`}</span>
            )}
            <span {...stylex.props(styles.captionRating)}>
              <StarRating rating={photo.rating} onChange={r => rate(photo, r)} size={14} onImage />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
