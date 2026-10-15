import type { AnimationPlaybackControls } from 'framer-motion'
import type { MouseEvent, WheelEvent } from 'react'
import type { Placeholder } from './ZoomableImage'
import type { IconComponent } from '~/lib/icon'
import type { PageDirection, SwipePager } from '~/lib/swipe-pager'
import type { Photo } from '~/types/photo'
import * as stylex from '@stylexjs/stylex'
import { animate, AnimatePresence, motion, useMotionValue } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseRegular from '~icons/mingcute/close-line'
import CopyRegular from '~icons/mingcute/copy-line'
import Delete2Regular from '~icons/mingcute/delete-2-line'
import LeftRegular from '~icons/mingcute/left-line'
import RightRegular from '~icons/mingcute/right-line'
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
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { largestCachedThumbnail, useThumbnail } from '~/hooks/useThumbnail'
import { isLibraryPath } from '~/lib/library'
import { convertFileSrc, convertPreviewSrc, writeText } from '~/lib/native'
import { ratingFromKey } from '~/lib/rating-key'
import { spring } from '~/lib/springs'
import { createSwipePager } from '~/lib/swipe-pager'
import { motion as motionTokens, radius } from '~/theme/layout.stylex'
import { text } from '~/theme/text'
import { Filmstrip } from './Filmstrip'
import { FittedImage, ZoomableImage } from './ZoomableImage'

/** Space between the photo and its neighbours as they slide past. */
const PAGE_GAP = 32
/** A swipe turns the page once it has gone this far, in px, or a fifth of the window. */
const PAGE_TURN_DISTANCE = 200
const SLIDE = { type: 'spring' as const, duration: 0.32, bounce: 0 }

function slideTransition() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? { duration: 0 } : SLIDE
}

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgb(0 0 0 / 0.9)',
    outline: 'none',
  },
  // The photo and its neighbours side by side, slid along by a swipe.
  track: { position: 'absolute', inset: 0 },
  page: { position: 'absolute', inset: 0, display: 'flex' },
  before: { transform: `translateX(calc(-100% - ${PAGE_GAP}px))` },
  after: { transform: `translateX(calc(100% + ${PAGE_GAP}px))` },
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
  notice: { margin: 'auto', color: 'rgb(255 255 255 / 0.8)' },
  // Above the filmstrip.
  caption: {
    position: 'absolute',
    bottom: 72,
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
  captionCloud: { flexShrink: 0, whiteSpace: 'nowrap', color: 'rgb(255 255 255 / 0.6)' },
  captionAction: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    borderWidth: 0,
    borderRadius: radius.item,
    paddingInline: 8,
    paddingBlock: 2,
    backgroundColor: { 'default': 'rgb(255 255 255 / 0.12)', ':hover': 'rgb(255 255 255 / 0.24)' },
    color: 'white',
    transitionProperty: 'background-color',
    transitionDuration: motionTokens.fast,
  },
})

/**
 * The longest edge iCloud keeps a thumbnail at. An undownloaded photo is
 * previewed from that, upscaled to fit.
 */
const CLOUD_PREVIEW_EDGE = 1024

type LightboxPosition = 'close' | 'prev' | 'next'

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
        aria-label={label}
        {...stylex.props(styles.button, styles[position])}
        onClick={onClick}
      >
        <Icon width={18} height={18} />
      </button>
    </Tooltip>
  )
}

function CloudNotice() {
  const { t } = useTranslation()
  return <div {...stylex.props(styles.notice, text.body)}>{t('preview.notDownloaded')}</div>
}

/** An undownloaded photo, shown from iCloud's thumbnail when it has one. */
function CloudPreview({ photo, folderPath }: { photo: Photo, folderPath: string | null }) {
  const url = useThumbnail(folderPath, photo.path, CLOUD_PREVIEW_EDGE, true, true)
  return url ? <FittedImage src={url} alt={photo.fileName} /> : <CloudNotice />
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
function Neighbour({ photo, folderPath, src }: { photo: Photo, folderPath: string | null, src: string }) {
  return photo.isCloudPlaceholder
    ? <CloudPreview photo={photo} folderPath={folderPath} />
    : <FittedImage src={src} placeholder={placeholderFor(folderPath, photo)} alt={photo.fileName} />
}

/** Marks an undownloaded photo in the caption, with a button to download it. */
function CloudCaption({ photo, folderPath }: { photo: Photo, folderPath: string | null }) {
  const { t } = useTranslation()
  const downloadPlaceholder = useDownloadPlaceholder(folderPath)
  const downloading = useAtomValue(downloadingIdsAtom).has(photo.id)
  return (
    <>
      <span {...stylex.props(styles.captionCloud)}>{t('preview.cloudOnly')}</span>
      <button
        type="button"
        disabled={downloading}
        {...stylex.props(styles.captionAction, text.caption)}
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
    if (isOpen)
      overlayRef.current?.focus()
  }, [isOpen])

  // The lightbox fades its photo in when it opens, but swaps photos in place
  // after that: fading each one in would blink the backdrop through.
  const [openedId, setOpenedId] = useState<string | null>(null)
  if (!photo && openedId !== null)
    setOpenedId(null)
  if (photo && openedId === null)
    setOpenedId(photo.id)

  const index = photo ? photos.findIndex(p => p.id === photo.id) : -1
  const edge = usePreviewEdge()
  const srcOf = useCallback((p: Photo) => convertPreviewSrc(p.path, edge), [edge])

  // Neighbours are decoded in the background, and a switch waits for the next
  // photo to decode, so the current one stays up until the next can paint.
  const { decode, retain, isDecoded } = useDecodedImages()
  useEffect(() => {
    if (index === -1)
      return
    const srcs = [photos[index - 1], photos[index], photos[index + 1]]
      .filter(p => p && !p.isCloudPlaceholder)
      .map(p => srcOf(p!))
    retain(srcs)
    for (const src of srcs)
      void decode(src)
  }, [index, photos, decode, retain, srcOf])
  useEffect(() => {
    if (!isOpen)
      retain([])
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
      if (photo.isCloudPlaceholder)
        return Promise.resolve()
      const full = decode(srcOf(photo))
      if (!isLibraryPath(folderPath))
        return full
      // A photo in the Photos library may take a while to read: the switch
      // waits only briefly for it (a neighbour is decoded already), then
      // goes ahead on its thumbnail.
      const placeholder = placeholderFor(folderPath, photo)
      const fallback = new Promise<void>(resolve => setTimeout(resolve, LIBRARY_SWITCH_WAIT_MS))
        .then(() => placeholder && decode(placeholder.src))
      return Promise.race([full, fallback])
    },
    [decode, folderPath, srcOf],
  )
  const goTo = useCallback(
    (delta: number) => {
      const next = index === -1 ? undefined : photos[index + delta]
      if (!next)
        return
      const token = ++switchRef.current
      void ready(next).then(() => {
        if (switchRef.current === token)
          setPreviewId(next.id)
      })
    },
    [index, photos, ready, setPreviewId],
  )
  // A swipe's page turn: the neighbour finishes sliding in, then lands.
  const turnPage = (direction: PageDirection) => {
    const next = photos[index + direction]
    if (!next)
      return
    const token = ++switchRef.current
    turningRef.current = true
    const slid = slideTo(-direction * (window.innerWidth + PAGE_GAP))
    void Promise.all([ready(next), slid]).then(() => {
      if (switchRef.current === token)
        setPreviewId(next.id)
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
    if (e.ctrlKey)
      return
    pagerRef.current ??= createSwipePager({
      distance: () => Math.min(PAGE_TURN_DISTANCE, window.innerWidth / 5),
      canPage: (direction) => {
        const { index, photos } = swipeRef.current
        return index !== -1 && photos[index + direction] !== undefined
      },
      follow: (offset) => {
        slideRef.current?.stop()
        slide.set(offset)
      },
      commit: direction => swipeRef.current.turnPage(direction),
      turning: () => turningRef.current,
      release: () => void slideTo(0),
    })
    pagerRef.current.push(e.nativeEvent)
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
          close()
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
          rate([current], rating)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [photo, goTo, close, deletePhoto, rate])

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
          onClick={close}
          onWheel={onWheel}
        >
          <motion.div className={stylex.props(styles.track).className} style={{ x: slide }}>
            {index > 0 && (
              <div {...stylex.props(styles.page, styles.before)}>
                <Neighbour photo={photos[index - 1]} folderPath={folderPath} src={srcOf(photos[index - 1])} />
              </div>
            )}
            <div {...stylex.props(styles.page)}>
              {photo.isCloudPlaceholder
                ? <CloudPreview photo={photo} folderPath={folderPath} />
                : (
                    <ZoomableImage
                      key={photo.id}
                      src={srcOf(photo)}
                      // Shown from a scaled copy, the photo itself loads
                      // for a closer look. A library photo is read at one
                      // size whatever is asked.
                      full={!isLibraryPath(folderPath) && Math.max(photo.width, photo.height) > edge
                        ? { src: convertFileSrc(photo.path), width: photo.width }
                        : undefined}
                      // A photo already decoded shows straight away, without
                      // its thumbnail and spinner blinking up first.
                      placeholder={isDecoded(srcOf(photo)) ? undefined : placeholderFor(folderPath, photo)}
                      alt={photo.fileName}
                      fadeIn={photo.id === openedId}
                      menuItems={isLibraryPath(folderPath)
                        // Not a file of its own to point at or delete.
                        ? [{ label: t('photoInfo.copyFileName'), icon: CopyRegular, onSelect: () => void writeText(photo.fileName) }]
                        : [
                            { label: t('common.copyPath'), icon: CopyRegular, onSelect: () => void writeText(photo.path) },
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
              <div {...stylex.props(styles.page, styles.after)}>
                <Neighbour photo={photos[index + 1]} folderPath={folderPath} src={srcOf(photos[index + 1])} />
              </div>
            )}
          </motion.div>
          <LightboxButton
            label={t('common.close')}
            icon={CloseRegular}
            position="close"
            onClick={close}
          />
          {index > 0 && (
            <LightboxButton
              label={t('preview.previous')}
              icon={LeftRegular}
              position="prev"
              onClick={(e) => {
                e.stopPropagation()
                goTo(-1)
              }}
            />
          )}
          {index !== -1 && index < photos.length - 1 && (
            <LightboxButton
              label={t('preview.next')}
              icon={RightRegular}
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
              <StarRating rating={photo.rating} onChange={r => rate([photo], r)} size={14} />
            </span>
            {photo.isCloudPlaceholder && <CloudCaption photo={photo} folderPath={folderPath} />}
          </div>
          {index !== -1 && (
            <Filmstrip
              photos={photos}
              index={index}
              folderPath={folderPath}
              onSelect={i => goTo(i - index)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
