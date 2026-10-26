import type { WheelEvent } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useFileName } from '~/hooks/useFileName'
import { thumbnailEdgeFor, useThumbnail } from '~/hooks/useThumbnail'
import { cn } from '~/lib/cn'
import type { Photo } from '~/types/photo'
import CloudRegular from '~icons/mingcute/cloud-line'

/** A thumbnail's side, in CSS px. */
const FILM_THUMB = 48
const FILM_GAP = 6
const STEP = FILM_THUMB + FILM_GAP
/** Thumbnails mounted past each edge of the strip. */
const OVERSCAN = 4

function FilmThumb({ photo, folderPath }: { photo: Photo; folderPath: string | null }) {
  const url = useThumbnail(folderPath, photo.path, thumbnailEdgeFor(FILM_THUMB), true, photo.isCloudPlaceholder)
  // Names the button, for a library photo, whose name is read as it shows.
  const fileName = useFileName(photo)
  if (photo.isCloudPlaceholder && !url) {
    return (
      <span className="flex size-full items-center justify-center text-white/60">
        <CloudRegular height={16} width={16} />
      </span>
    )
  }
  return url ? <img alt={fileName} className="block size-full object-contain" draggable={false} src={url} /> : null
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
  folderPath: string | null
  index: number
  onSelect: (index: number) => void
  photos: Photo[]
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
    if (!el) return
    const left = index * STEP
    if (placedRef.current && typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: 'smooth' })
    else el.scrollLeft = left
    placedRef.current = true
  }, [index, width])

  const first = Math.max(0, Math.floor((scrollLeft - pad) / STEP) - OVERSCAN)
  const last = Math.min(photos.length - 1, Math.ceil((scrollLeft - pad + width) / STEP) + OVERSCAN)
  const shown = photos.slice(first, last + 1)

  return (
    <div
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      onWheel={(e: WheelEvent<HTMLDivElement>) => {
        // Scrolling the strip is browsing it, not swiping the photo.
        e.stopPropagation()
        // A mouse wheel only turns down; along the strip is the way to go.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
      }}
      ref={ref}
      // Scrolls natively, at the trackpad's own speed and momentum.
      className="absolute inset-x-0 bottom-2 h-14 overflow-x-auto overflow-y-hidden overscroll-contain [scrollbar-width:none]"
    >
      {/* As wide as every thumbnail, with half the strip's width either end so
       * the first and last can come to the middle. */}
      <div className="relative h-full" style={{ width: 2 * pad + (photos.length - 1) * STEP + FILM_THUMB }}>
        {shown.map((photo, i) => {
          const at = first + i
          return (
            <button
              aria-label={photo.fileName || undefined}
              key={photo.id}
              style={{ left: pad + at * STEP }}
              type="button"
              className={cn(
                'absolute top-1 size-12 overflow-hidden bg-white/10 p-0 transition-[opacity,box-shadow] duration-200 ease-out',
                at === index ? 'opacity-100 shadow-[0_0_0_2px_white]' : 'opacity-45 hover:opacity-80',
              )}
              onClick={() => onSelect(at)}
              aria-current={at === index}
              // The lightbox's arrow keys move through these already.
              tabIndex={-1}
            >
              <FilmThumb folderPath={folderPath} photo={photo} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
