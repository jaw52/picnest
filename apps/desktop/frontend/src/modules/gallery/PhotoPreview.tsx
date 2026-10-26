import { useAtomValue, useSetAtom } from 'jotai'
import type { AnimationPlaybackControls } from 'motion/react'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import type { MouseEvent, WheelEvent } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  closePreviewAtom,
  currentFolderAtom,
  previewPhotoAtom,
  previewPhotoIdAtom,
  previewPhotosAtom,
} from '~/atoms/gallery'
import { StarRating } from '~/components/StarRating'
import { Tooltip } from '~/components/Tooltip'
import { useDecodedImages } from '~/hooks/useDecodedImages'
import { useDeletePhoto } from '~/hooks/useDeletePhoto'
import { downloadingIdsAtom, useDownloadPlaceholder } from '~/hooks/useDownloadPlaceholder'
import { useFileName } from '~/hooks/useFileName'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { largestCachedThumbnail, useThumbnail } from '~/hooks/useThumbnail'
import { cn } from '~/lib/cn'
import type { IconComponent } from '~/lib/icon'
import { isLibraryPath } from '~/lib/library'
import { convertFileSrc, convertLiveSrc, convertPreviewSrc, writeText } from '~/lib/native'
import { ratingFromKey } from '~/lib/rating-key'
import { spring } from '~/lib/springs'
import type { PageDirection, SwipePager } from '~/lib/swipe-pager'
import { createSwipePager } from '~/lib/swipe-pager'
import type { Photo } from '~/types/photo'
import CloseRegular from '~icons/mingcute/close-line'
import CopyRegular from '~icons/mingcute/copy-line'
import Delete2Regular from '~icons/mingcute/delete-2-line'
import LeftRegular from '~icons/mingcute/left-line'
import RightRegular from '~icons/mingcute/right-line'

import { Filmstrip } from './Filmstrip'
import type { Placeholder } from './ZoomableImage'
import { FittedImage, ZoomableImage } from './ZoomableImage'

/** Space between the photo and its neighbours as they slide past. */
const PAGE_GAP = 32
/** A swipe turns the page once it has gone this far, in px, or a fifth of the window. */
const PAGE_TURN_DISTANCE = 200
const SLIDE = { type: 'spring' as const, duration: 0.32, bounce: 0 }

function slideTransition() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? { duration: 0 } : SLIDE
}

/**
 * The longest edge iCloud keeps a thumbnail at. An undownloaded photo is
 * previewed from that, upscaled to fit.
 */
const CLOUD_PREVIEW_EDGE = 1024

type LightboxPosition = 'close' | 'prev' | 'next'

const POSITION_CLASS: Record<LightboxPosition, string> = {
  close: 'top-4 right-4',
  prev: 'top-1/2 left-4 -translate-y-1/2',
  next: 'top-1/2 right-4 -translate-y-1/2',
}

function LightboxButton({
  label,
  icon: Icon,
  position,
  onClick,
}: {
  label: string
  icon: IconComponent
  position: LightboxPosition
  onClick: (e: MouseEvent) => void
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        // A round control on the lightbox, which stays dark whatever the theme.
        className={cn(
          'absolute flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors duration-80 hover:bg-white/20 hover:text-white active:bg-white/25',
          POSITION_CLASS[position],
        )}
      >
        <Icon height={18} width={18} />
      </button>
    </Tooltip>
  )
}

function CloudNotice() {
  const { t } = useTranslation()
  return <div className="m-auto text-body text-white/80">{t('preview.notDownloaded')}</div>
}

/** An undownloaded photo, shown from iCloud's thumbnail when it has one. */
function CloudPreview({ photo, folderPath }: { photo: Photo; folderPath: string | null }) {
  const url = useThumbnail(folderPath, photo.path, CLOUD_PREVIEW_EDGE, true, true)
  return url ? <FittedImage alt={photo.fileName} src={url} /> : <CloudNotice />
}

/**
 * What stands in for a photo in the Photos library while it loads: its
 * thumbnail from the grid or the filmstrip. Reading the photo itself goes
 * through Photos, and may download it from iCloud, so the viewer moves on
 * with the thumbnail rather than wait. A file on disk loads fast enough to
 * wait for.
 */
/** How long a switch waits for a library photo before showing its thumbnail. */
const LIBRARY_SWITCH_WAIT_MS = 120

function placeholderFor(folderPath: string | null, photo: Photo): Placeholder | undefined {
  const src = isLibraryPath(folderPath) ? largestCachedThumbnail(folderPath, photo.path) : undefined
  return src ? { src, width: photo.width, height: photo.height } : undefined
}

/** Steps the preview size goes up in, so a slightly larger window doesn't load every photo again. */
const PREVIEW_EDGE_STEP = 512

/** Pixels on the longest side of a photo that fill the window on this display. */
function previewEdge() {
  const longest = Math.max(window.innerWidth, window.innerHeight) * window.devicePixelRatio
  return Math.ceil(longest / PREVIEW_EDGE_STEP) * PREVIEW_EDGE_STEP
}

/**
 * The size photos are shown at fit, which follows the window. A photo
 * larger than that is shown from a copy scaled to it: WebKit stalls the
 * page for 100ms or more to paint a photo of 12 megapixels or more, even one
 * decoded beforehand.
 */
function usePreviewEdge() {
  const [edge, setEdge] = useState(previewEdge)
  useEffect(() => {
    const update = () => setEdge(previewEdge())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return edge
}

/** The photo either side of the one shown, in place for a swipe to slide in. */
function Neighbour({ photo, folderPath, src }: { photo: Photo; folderPath: string | null; src: string }) {
  const fileName = useFileName(photo)
  return photo.isCloudPlaceholder ? (
    <CloudPreview folderPath={folderPath} photo={photo} />
  ) : (
    <FittedImage alt={fileName} placeholder={placeholderFor(folderPath, photo)} src={src} />
  )
}

/** Marks an undownloaded photo in the caption, with a button to download it. */
function CloudCaption({ photo, folderPath }: { photo: Photo; folderPath: string | null }) {
  const { t } = useTranslation()
  const downloadPlaceholder = useDownloadPlaceholder(folderPath)
  const downloading = useAtomValue(downloadingIdsAtom).has(photo.id)
  return (
    <>
      <span className="shrink-0 whitespace-nowrap text-white/60">{t('preview.cloudOnly')}</span>
      <button
        className="shrink-0 rounded-item bg-white/10 px-2 py-0.5 text-caption whitespace-nowrap text-white transition-colors duration-80 hover:bg-white/25"
        disabled={downloading}
        type="button"
        onClick={() => void downloadPlaceholder(photo)}
      >
        {downloading ? t('gallery.downloading') : t('preview.downloadOriginal')}
      </button>
    </>
  )
}

export function PhotoPreview() {
  const { t } = useTranslation()
  const photos = useAtomValue(previewPhotosAtom)
  const photo = useAtomValue(previewPhotoAtom)
  const fileName = useFileName(photo)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  // Closing selects the photo last shown in the grid, which takes the focus.
  const close = useSetAtom(closePreviewAtom)
  const folderPath = useAtomValue(currentFolderAtom)
  const deletePhoto = useDeletePhoto(folderPath)
  const rate = useRatePhoto(folderPath)

  // Move focus into the lightbox while it's open; on close the grid focuses
  // the photo last shown (see closePreviewAtom).
  const overlayRef = useRef<HTMLDivElement>(null)
  const isOpen = photo !== null
  useEffect(() => {
    if (isOpen) overlayRef.current?.focus()
  }, [isOpen])

  // The lightbox fades its photo in when it opens, but swaps photos in place
  // after that: fading each one in would blink the backdrop through.
  const [openedId, setOpenedId] = useState<string | null>(null)
  if (!photo && openedId !== null) setOpenedId(null)
  if (photo && openedId === null) setOpenedId(photo.id)

  const index = photo ? photos.findIndex((p) => p.id === photo.id) : -1
  const edge = usePreviewEdge()
  const srcOf = useCallback((p: Photo) => convertPreviewSrc(p.path, edge), [edge])

  // Neighbours are decoded in the background, and a switch waits for the next
  // photo to decode, so the current one stays up until the next can paint.
  const { decode, retain, isDecoded } = useDecodedImages()
  useEffect(() => {
    if (index === -1) return
    const srcs = [photos[index - 1], photos[index], photos[index + 1]]
      .filter((p) => p !== undefined && !p.isCloudPlaceholder)
      .map((p) => srcOf(p))
    retain(srcs)
    for (const src of srcs) void decode(src)
  }, [index, photos, decode, retain, srcOf])
  useEffect(() => {
    if (!isOpen) retain([])
  }, [isOpen, retain])

  // How far the photo and its neighbours are slid, by a swipe in progress.
  const slide = useMotionValue(0)
  const slideRef = useRef<AnimationPlaybackControls | null>(null)
  function slideTo(x: number) {
    slideRef.current?.stop()
    slideRef.current = animate(slide, x, slideTransition())
    return slideRef.current
  }

  // Only the latest switch lands, should several be waiting on decodes.
  const switchRef = useRef(0)
  // A swipe's page turn is sliding the next photo in.
  const turningRef = useRef(false)
  // The track goes back in place before the new photo paints, so the
  // neighbour slid into view is swapped for the same photo, unmoved. Closing
  // mid-slide leaves it in place for the next opening too.
  const shownId = photo?.id
  useLayoutEffect(() => {
    turningRef.current = false
    slideRef.current?.stop()
    slide.jump(0)
  }, [shownId, slide])
  const ready = useCallback(
    (photo: Photo) => {
      if (photo.isCloudPlaceholder) return Promise.resolve()
      const full = decode(srcOf(photo))
      if (!isLibraryPath(folderPath)) return full
      // A photo in the Photos library may take a while to read: the switch
      // waits only briefly for it (a neighbour is decoded already), then
      // goes ahead on its thumbnail.
      const placeholder = placeholderFor(folderPath, photo)
      const fallback = new Promise<void>((resolve) => setTimeout(resolve, LIBRARY_SWITCH_WAIT_MS)).then(
        () => placeholder && decode(placeholder.src),
      )
      return Promise.race([full, fallback])
    },
    [decode, folderPath, srcOf],
  )
  const goTo = useCallback(
    (delta: number) => {
      const next = index === -1 ? undefined : photos[index + delta]
      if (next === undefined) return
      const token = ++switchRef.current
      void ready(next).then(() => {
        if (switchRef.current === token) setPreviewId(next.id)
      })
    },
    [index, photos, ready, setPreviewId],
  )
  // A swipe's page turn: the neighbour finishes sliding in, then lands.
  const turnPage = (direction: PageDirection) => {
    const next = photos[index + direction]
    if (next === undefined) return
    const token = ++switchRef.current
    turningRef.current = true
    const slid = slideTo(-direction * (window.innerWidth + PAGE_GAP)).finished
    void Promise.all([ready(next), slid]).then(() => {
      if (switchRef.current === token) setPreviewId(next.id)
    })
  }

  // Two-finger horizontal swipe, the photo following the fingers. Lives here
  // rather than in ZoomableImage because that remounts with every photo,
  // which would lose track of the gesture mid-momentum. The pager outlives
  // renders, so it reaches this render's state through a ref.
  const swipeRef = useRef({ index, photos, turnPage })
  useEffect(() => {
    swipeRef.current = { index, photos, turnPage }
  })
  const pagerRef = useRef<SwipePager | null>(null)
  useEffect(() => () => pagerRef.current?.dispose(), [])
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.ctrlKey) return
    if (!pagerRef.current) {
      pagerRef.current = createSwipePager({
        distance: () => Math.min(PAGE_TURN_DISTANCE, window.innerWidth / 5),
        canPage: (direction) => {
          const { index, photos } = swipeRef.current
          return index !== -1 && photos[index + direction] !== undefined
        },
        follow: (offset) => {
          slideRef.current?.stop()
          slide.set(offset)
        },
        commit: (direction) => swipeRef.current.turnPage(direction),
        turning: () => turningRef.current,
        release: () => void slideTo(0),
      })
    }
    pagerRef.current.push(e.nativeEvent)
  }

  useEffect(() => {
    if (!photo) return
    const current = photo
    function onKeyDown(e: KeyboardEvent) {
      // Space closes it too, as Quick Look does in Finder.
      switch (e.key) {
        case 'Escape':
        case ' ': {
          e.preventDefault()
          if (!e.repeat) close()

          break
        }
        case 'ArrowLeft': {
          goTo(-1)

          break
        }
        case 'ArrowRight': {
          goTo(1)

          break
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault()
          if (!e.repeat) void deletePhoto([current])

          break
        }
        default: {
          const rating = ratingFromKey(e)
          if (rating !== null) rate([current], rating)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [photo, goTo, close, deletePhoto, rate])

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          animate={{ opacity: 1 }}
          aria-label={fileName}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 outline-none"
          exit={{ opacity: 0, transition: spring.slow.exit }}
          initial={{ opacity: 0 }}
          ref={overlayRef}
          role="dialog"
          tabIndex={-1}
          transition={spring.slow}
          onClick={close}
          onWheel={onWheel}
        >
          {/* The photo and its neighbours side by side, slid along by a swipe. */}
          <motion.div className="absolute inset-0" style={{ x: slide }}>
            {index > 0 && (
              <div className="absolute inset-0 flex -translate-x-[calc(100%+32px)]">
                <Neighbour folderPath={folderPath} photo={photos[index - 1]} src={srcOf(photos[index - 1])} />
              </div>
            )}
            <div className="absolute inset-0 flex">
              {photo.isCloudPlaceholder ? (
                <CloudPreview folderPath={folderPath} photo={photo} />
              ) : (
                <ZoomableImage
                  alt={fileName}
                  src={srcOf(photo)}
                  // Shown from a scaled copy, the photo itself loads
                  // for a closer look.
                  full={
                    Math.max(photo.width, photo.height) > edge
                      ? { src: convertFileSrc(photo.path), width: photo.width }
                      : undefined
                  }
                  // A photo already decoded shows straight away, without
                  // its thumbnail and spinner blinking up first.
                  fadeIn={photo.id === openedId}
                  key={photo.id}
                  live={photo.live && { src: convertLiveSrc(photo.path, photo.modified), loop: photo.live === 'loop' }}
                  placeholder={isDecoded(srcOf(photo)) ? undefined : placeholderFor(folderPath, photo)}
                  menuItems={[
                    isLibraryPath(folderPath)
                      ? // Not a file of its own to point at.
                        {
                          label: t('photoInfo.copyFileName'),
                          icon: CopyRegular,
                          onSelect: () => void writeText(fileName),
                        }
                      : { label: t('common.copyPath'), icon: CopyRegular, onSelect: () => void writeText(photo.path) },
                    {
                      label: t('common.delete'),
                      icon: Delete2Regular,
                      destructive: true,
                      onSelect: () => void deletePhoto([photo]),
                    },
                  ]}
                />
              )}
            </div>
            {index !== -1 && index < photos.length - 1 && (
              <div className="absolute inset-0 flex translate-x-[calc(100%+32px)]">
                <Neighbour folderPath={folderPath} photo={photos[index + 1]} src={srcOf(photos[index + 1])} />
              </div>
            )}
          </motion.div>
          <LightboxButton icon={CloseRegular} label={t('common.close')} position="close" onClick={close} />
          {index > 0 && (
            <LightboxButton
              icon={LeftRegular}
              label={t('preview.previous')}
              position="prev"
              onClick={(e) => {
                e.stopPropagation()
                goTo(-1)
              }}
            />
          )}
          {index !== -1 && index < photos.length - 1 && (
            <LightboxButton
              icon={RightRegular}
              label={t('preview.next')}
              position="next"
              onClick={(e) => {
                e.stopPropagation()
                goTo(1)
              }}
            />
          )}
          {/* Above the filmstrip. As wide as its content, up to the window: a long
           * file name gives way (it ellipsizes) instead of squeezing the count onto
           * two lines. */}
          <div
            className="absolute bottom-18 left-1/2 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-item bg-white/10 px-3 py-1 text-caption text-white/80"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="min-w-0 truncate">{fileName}</span>
            {index !== -1 && (
              <span className="shrink-0 whitespace-nowrap text-white/60 tabular-nums">{`${index + 1} / ${photos.length}`}</span>
            )}
            <span className="flex shrink-0">
              <StarRating rating={photo.rating} size={14} onChange={(r) => rate([photo], r)} />
            </span>
            {photo.isCloudPlaceholder && <CloudCaption folderPath={folderPath} photo={photo} />}
          </div>
          {index !== -1 && (
            <Filmstrip folderPath={folderPath} index={index} photos={photos} onSelect={(i) => goTo(i - index)} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
