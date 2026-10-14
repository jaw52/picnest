import type { WheelEvent } from 'react'
import type { Photo } from '~/types/photo'
import { CloudRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'

/** A thumbnail's side, in CSS px. */
const FILM_THUMB = 48
const FILM_GAP = 6
const STEP = FILM_THUMB + FILM_GAP
/** Room above and below the thumbnails for the current one's ring. */
const RING_ROOM = 4
/** Thumbnails mounted past each edge of the strip. */
const OVERSCAN = 4

const styles = stylex.create({
  // Scrolls natively, at the trackpad's own speed and momentum.
  strip: {
    position: 'absolute',
    insetInline: 0,
    bottom: 12 - RING_ROOM,
    height: FILM_THUMB + 2 * RING_ROOM,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    overscrollBehavior: 'contain',
  },
  // As wide as every thumbnail, with half the strip's width either end so
  // the first and last can come to the middle.
  content: { position: 'relative', height: '100%' },
  contentWidth: (width: number) => ({ width }),
  thumb: {
    position: 'absolute',
    top: RING_ROOM,
    width: FILM_THUMB,
    height: FILM_THUMB,
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'rgb(255 255 255 / 0.08)',
    opacity: { 'default': 0.45, ':hover': 0.8 },
    transitionProperty: 'opacity, box-shadow',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-out',
  },
  at: (left: number) => ({ left }),
  current: {
    opacity: { 'default': 1, ':hover': 1 },
    boxShadow: '0 0 0 2px white',
  },
  // The whole photo, letterboxed in its square.
  image: { display: 'block', width: '100%', height: '100%', objectFit: 'contain' },
  cloud: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgb(255 255 255 / 0.6)',
  },
})

function FilmThumb({ photo, folderPath }: { photo: Photo, folderPath: string | null }) {
  const url = useThumbnail(folderPath, photo.path, thumbnailEdgeFor(FILM_THUMB), !photo.isCloudPlaceholder)
  if (photo.isCloudPlaceholder) {
    return (
      <span {...stylex.props(styles.cloud)}>
        <CloudRegular size={16} />
      </span>
    )
  }
  return url ? <img src={url} alt="" draggable={false} {...stylex.props(styles.image)} /> : null
}

/** The strip spans the window. */
function useStripWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

interface FilmstripProps {
  photos: Photo[]
  index: number
  folderPath: string | null
  onSelect: (index: number) => void
}

/**
 * The lightbox's strip of thumbnails. It scrolls on its own, to browse
 * without changing the photo; clicking a thumbnail shows it, and whenever
 * the photo changes the strip brings it to the middle. Only the thumbnails
 * in view are mounted.
 */
export function Filmstrip({ photos, index, folderPath, onSelect }: FilmstripProps) {
  const ref = useRef<HTMLDivElement>(null)
  const width = useStripWidth()
  // Scrolled to `i * STEP`, thumbnail i is in the middle.
  const pad = width / 2 - FILM_THUMB / 2
  const [scrollLeft, setScrollLeft] = useState(index * STEP)

  // The photo shown comes to the middle: at once when the lightbox opens,
  // gliding after that.
  const placedRef = useRef(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el)
      return
    const left = index * STEP
    if (placedRef.current && el.scrollTo)
      el.scrollTo({ left, behavior: 'smooth' })
    else
      el.scrollLeft = left
    placedRef.current = true
  }, [index, width])

  const first = Math.max(0, Math.floor((scrollLeft - pad) / STEP) - OVERSCAN)
  const last = Math.min(photos.length - 1, Math.ceil((scrollLeft - pad + width) / STEP) + OVERSCAN)
  const shown = photos.slice(first, last + 1)

  return (
    <div
      ref={ref}
      {...stylex.props(styles.strip)}
      onClick={e => e.stopPropagation()}
      onScroll={e => setScrollLeft(e.currentTarget.scrollLeft)}
      onWheel={(e: WheelEvent<HTMLDivElement>) => {
        // Scrolling the strip is browsing it, not swiping the photo.
        e.stopPropagation()
        // A mouse wheel only turns down; along the strip is the way to go.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX))
          e.currentTarget.scrollLeft += e.deltaY
      }}
    >
      <div {...stylex.props(styles.content, styles.contentWidth(2 * pad + (photos.length - 1) * STEP + FILM_THUMB))}>
        {shown.map((photo, i) => {
          const at = first + i
          return (
            <button
              key={photo.id}
              type="button"
              aria-label={photo.fileName}
              aria-current={at === index}
              // The lightbox's arrow keys move through these already.
              tabIndex={-1}
              {...stylex.props(styles.thumb, styles.at(pad + at * STEP), at === index && styles.current)}
              onClick={() => onSelect(at)}
            >
              <FilmThumb photo={photo} folderPath={folderPath} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
