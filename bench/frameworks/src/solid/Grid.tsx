import type { Photo } from '../shared/types.ts'
import { createMemo, createSignal, For, onCleanup, onMount } from 'solid-js'
import { flatColor, STARS } from '../shared/gallery.ts'
import { layoutMasonry, snapScroll, visibleCells } from '../shared/masonry.ts'

interface GridProps {
  photos: Photo[]
  columnWidth: number
  selection: ReadonlySet<string>
  onOpen: (id: string) => void
  onRate: (id: string, rating: number) => void
  onToggle: (id: string) => void
  ratingOf: (photo: Photo) => number
}

export function Grid(props: GridProps) {
  let scroller!: HTMLDivElement
  let grid!: HTMLDivElement
  const [containerWidth, setContainerWidth] = createSignal(0)
  const [viewport, setViewport] = createSignal({ top: 0, height: 0 }, {
    equals: (a, b) => a.top === b.top && a.height === b.height,
  })

  onMount(() => {
    let frame = 0
    function update() {
      frame = 0
      // A hidden tab measures zero; keep what it had.
      if (scroller.clientHeight > 0)
        setViewport({ top: snapScroll(scroller.scrollTop), height: scroller.clientHeight })
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
    onCleanup(() => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scroller.removeEventListener('scroll', schedule)
    })
  })

  const layout = createMemo(() => layoutMasonry(props.photos.map(p => p.aspectRatio), containerWidth(), props.columnWidth))
  const visible = createMemo(() => {
    const { top, height } = viewport()
    return containerWidth() > 0 ? visibleCells(layout().cells, top, height) : []
  })
  // Keyed by photo, like React's key: a tile stays mounted while its photo
  // stays in view, whatever its index.
  const visiblePhotos = createMemo(() => visible().map(i => props.photos[i]))

  return (
    <div ref={scroller} class="scroller">
      <div ref={grid} class="grid" style={{ height: `${layout().height}px` }}>
        <For each={visiblePhotos()}>
          {(photo, k) => {
            const cell = () => layout().cells[visible()[k()]]
            const selected = () => props.selection.has(photo.id)
            return (
              <div
                class="tile"
                classList={{ selected: selected() }}
                data-photo-id={photo.id}
                role="option"
                aria-selected={selected()}
                style={{
                  top: `${cell().top}px`,
                  left: `${cell().left}px`,
                  width: `${layout().columnWidth}px`,
                  height: `${cell().height}px`,
                }}
                onClick={e => (e.metaKey ? props.onToggle(photo.id) : props.onOpen(photo.id))}
              >
                {photo.thumb
                  ? <img class="thumb" src={photo.thumb} alt="" decoding="async" draggable={false} />
                  : <div class="thumb" style={{ background: flatColor(photo) }} />}
                <div class="caption">
                  <span class="name">{photo.name}</span>
                  <Stars rating={props.ratingOf(photo)} onRate={rating => props.onRate(photo.id, rating)} />
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

function Stars(props: { rating: number, onRate: (rating: number) => void }) {
  return (
    <div class="stars">
      <For each={STARS}>
        {star => (
          <button
            type="button"
            data-star={star}
            classList={{ on: star <= props.rating }}
            onClick={(e) => {
              e.stopPropagation()
              props.onRate(star === props.rating ? 0 : star)
            }}
          >
            ★
          </button>
        )}
      </For>
    </div>
  )
}
