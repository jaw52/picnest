import type { MouseEvent } from 'react'
import type { MasonryCell } from '../shared/masonry.ts'
import type { Photo } from '../shared/types.ts'
import type { Ratings } from './ratings.ts'
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flatColor, STARS } from '../shared/gallery.ts'
import { layoutMasonry, snapScroll, visibleCells } from '../shared/masonry.ts'

interface GridProps {
  photos: Photo[]
  columnWidth: number
  selection: ReadonlySet<string>
  onOpen: (id: string) => void
  onRate: (id: string, rating: number) => void
  onToggle: (id: string) => void
  ratings: Ratings
}

export function Grid({ photos, columnWidth, selection, onOpen, onRate, onToggle, ratings }: GridProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })

  useLayoutEffect(() => {
    const grid = gridRef.current!
    const scroller = scrollerRef.current!
    let frame = 0
    function update() {
      frame = 0
      // A hidden tab measures zero; keep what it had.
      if (scroller.clientHeight === 0)
        return
      const top = snapScroll(scroller.scrollTop)
      const height = scroller.clientHeight
      setViewport(prev => (prev.top === top && prev.height === height ? prev : { top, height }))
    }
    function schedule() {
      frame ||= requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(() => {
      if (grid.clientWidth > 0)
        setContainerWidth(grid.clientWidth)
      schedule()
    })
    observer.observe(grid)
    observer.observe(scroller)
    scroller.addEventListener('scroll', schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scroller.removeEventListener('scroll', schedule)
    }
  }, [])

  const layout = useMemo(
    () => layoutMasonry(photos.map(p => p.aspectRatio), containerWidth, columnWidth),
    [photos, containerWidth, columnWidth],
  )
  const visible = useMemo(
    () => visibleCells(layout.cells, viewport.top, viewport.height),
    [layout, viewport],
  )

  return (
    <div ref={scrollerRef} className="scroller">
      <div ref={gridRef} className="grid" style={{ height: layout.height }}>
        {containerWidth > 0 && visible.map((i) => {
          const photo = photos[i]
          return (
            <Tile
              key={photo.id}
              photo={photo}
              cell={layout.cells[i]}
              width={layout.columnWidth}
              selected={selection.has(photo.id)}
              onOpen={onOpen}
              onRate={onRate}
              onToggle={onToggle}
              ratings={ratings}
            />
          )
        })}
      </div>
    </div>
  )
}

interface TileProps {
  photo: Photo
  cell: MasonryCell
  width: number
  selected: boolean
  onOpen: (id: string) => void
  onRate: (id: string, rating: number) => void
  onToggle: (id: string) => void
  ratings: Ratings
}

const Tile = memo(({ photo, cell, width, selected, onOpen, onRate, onToggle, ratings }: TileProps) => {
  const subscribe = useCallback((listener: () => void) => ratings.subscribe(photo.id, listener), [ratings, photo.id])
  const rating = useSyncExternalStore(subscribe, () => ratings.get(photo))
  function click(e: MouseEvent) {
    if (e.metaKey)
      onToggle(photo.id)
    else
      onOpen(photo.id)
  }
  return (
    <div
      className={selected ? 'tile selected' : 'tile'}
      data-photo-id={photo.id}
      role="option"
      aria-selected={selected}
      style={{ top: cell.top, left: cell.left, width, height: cell.height }}
      onClick={click}
    >
      {photo.thumb
        ? <img className="thumb" src={photo.thumb} alt="" decoding="async" draggable={false} />
        : <div className="thumb" style={{ background: flatColor(photo) }} />}
      <div className="caption">
        <span className="name">{photo.name}</span>
        <Stars rating={rating} onRate={star => onRate(photo.id, star)} />
      </div>
    </div>
  )
})

export function Stars({ rating, onRate }: { rating: number, onRate: (rating: number) => void }) {
  return (
    <div className="stars">
      {STARS.map(star => (
        <button
          key={star}
          type="button"
          data-star={star}
          className={star <= rating ? 'on' : ''}
          onClick={(e) => {
            e.stopPropagation()
            onRate(star === rating ? 0 : star)
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}
