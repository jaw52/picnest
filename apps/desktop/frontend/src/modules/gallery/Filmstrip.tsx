import type { Photo } from '~/types/photo'
import { CloudRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useState } from 'react'
import { thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'

/** A thumbnail's side, in CSS px. */
const FILM_THUMB = 48
const FILM_GAP = 6
const STEP = FILM_THUMB + FILM_GAP
/** Extra thumbnails mounted past each edge, so a step slides one in from off screen. */
const OVERSCAN = 2

const styles = stylex.create({
  strip: {
    position: 'absolute',
    insetInline: 0,
    bottom: 12,
    height: FILM_THUMB,
    overflow: 'hidden',
  },
  // Every thumbnail sits at the centre and is moved out by its distance
  // from the current photo, so a step slides the whole strip.
  thumb: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: FILM_THUMB,
    height: FILM_THUMB,
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'rgb(255 255 255 / 0.08)',
    opacity: { 'default': 0.45, ':hover': 0.8 },
    transitionProperty: 'transform, opacity, box-shadow',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-out',
  },
  offset: (x: number) => ({ transform: `translateX(${x}px)` }),
  current: {
    opacity: { 'default': 1, ':hover': 1 },
    boxShadow: '0 0 0 2px white',
  },
  image: { display: 'block', width: '100%', height: '100%', objectFit: 'cover' },
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

/** How many thumbnails fit on each side of the centre of the window. */
function useSideCount() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return Math.ceil(width / 2 / STEP) + OVERSCAN
}

interface FilmstripProps {
  photos: Photo[]
  index: number
  folderPath: string | null
  onSelect: (index: number) => void
}

/**
 * The lightbox's strip of thumbnails: the photo shown is in the middle, its
 * neighbours either side, and clicking one shows it. Only the thumbnails
 * that fit the window are mounted.
 */
export function Filmstrip({ photos, index, folderPath, onSelect }: FilmstripProps) {
  const side = useSideCount()
  const shown = photos
    .slice(Math.max(0, index - side), index + side + 1)
    .map((photo, i) => ({ photo, at: Math.max(0, index - side) + i }))

  return (
    <div
      {...stylex.props(styles.strip)}
      onClick={e => e.stopPropagation()}
    >
      {shown.map(({ photo, at }) => (
        <button
          key={photo.id}
          type="button"
          aria-label={photo.fileName}
          aria-current={at === index}
          // The lightbox's arrow keys move through these already.
          tabIndex={-1}
          {...stylex.props(
            styles.thumb,
            styles.offset((at - index) * STEP - FILM_THUMB / 2),
            at === index && styles.current,
          )}
          onClick={() => onSelect(at)}
        >
          <FilmThumb photo={photo} folderPath={folderPath} />
        </button>
      ))}
    </div>
  )
}
