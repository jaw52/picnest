import type { Photo } from '../shared/types.ts'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
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

export const Grid = defineComponent((props: GridProps) => {
  const scroller = ref<HTMLDivElement>()
  const grid = ref<HTMLDivElement>()
  const containerWidth = ref(0)
  const viewport = shallowRef({ top: 0, height: 0 })

  let frame = 0
  let observer: ResizeObserver | undefined
  function update() {
    frame = 0
    const el = scroller.value!
    // A hidden tab measures zero; keep what it had.
    if (el.clientHeight === 0)
      return
    const top = snapScroll(el.scrollTop)
    const height = el.clientHeight
    if (viewport.value.top !== top || viewport.value.height !== height)
      viewport.value = { top, height }
  }
  function schedule() {
    frame ||= requestAnimationFrame(update)
  }
  onMounted(() => {
    observer = new ResizeObserver(() => {
      if (grid.value!.clientWidth > 0)
        containerWidth.value = grid.value!.clientWidth
      schedule()
    })
    observer.observe(grid.value!)
    observer.observe(scroller.value!)
    scroller.value!.addEventListener('scroll', schedule, { passive: true })
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
    scroller.value?.removeEventListener('scroll', schedule)
  })

  const layout = computed(() => layoutMasonry(props.photos.map(p => p.aspectRatio), containerWidth.value, props.columnWidth))
  const visible = computed(() => visibleCells(layout.value.cells, viewport.value.top, viewport.value.height))

  return () => (
    <div ref={scroller} class="scroller">
      <div ref={grid} class="grid" style={{ height: `${layout.value.height}px` }}>
        {containerWidth.value > 0 && visible.value.map((i) => {
          const photo = props.photos[i]
          const cell = layout.value.cells[i]
          return (
            <Tile
              key={photo.id}
              photo={photo}
              top={cell.top}
              left={cell.left}
              width={layout.value.columnWidth}
              height={cell.height}
              selected={props.selection.has(photo.id)}
              ratingOf={props.ratingOf}
              onOpen={props.onOpen}
              onRate={props.onRate}
              onToggle={props.onToggle}
            />
          )
        })}
      </div>
    </div>
  )
}, { props: ['photos', 'columnWidth', 'selection', 'onOpen', 'onRate', 'onToggle', 'ratingOf'] })

interface TileProps {
  photo: Photo
  top: number
  left: number
  width: number
  height: number
  selected: boolean
  ratingOf: (photo: Photo) => number
  onOpen: (id: string) => void
  onRate: (id: string, rating: number) => void
  onToggle: (id: string) => void
}

const Tile = defineComponent((props: TileProps) => {
  function click(e: MouseEvent) {
    if (e.metaKey)
      props.onToggle(props.photo.id)
    else
      props.onOpen(props.photo.id)
  }
  function rate(rating: number) {
    props.onRate(props.photo.id, rating)
  }
  return () => {
    const { photo } = props
    const { selected } = props
    return (
      <div
        class={selected ? 'tile selected' : 'tile'}
        data-photo-id={photo.id}
        role="option"
        aria-selected={selected}
        style={{ top: `${props.top}px`, left: `${props.left}px`, width: `${props.width}px`, height: `${props.height}px` }}
        onClick={click}
      >
        {photo.thumb
          ? <img class="thumb" src={photo.thumb} alt="" decoding="async" draggable={false} />
          : <div class="thumb" style={{ background: flatColor(photo) }} />}
        <div class="caption">
          <span class="name">{photo.name}</span>
          <Stars rating={props.ratingOf(photo)} onRate={rate} />
        </div>
      </div>
    )
  }
}, { props: ['photo', 'top', 'left', 'width', 'height', 'selected', 'onOpen', 'onRate', 'onToggle', 'ratingOf'] })

export const Stars = defineComponent((props: { rating: number, onRate: (rating: number) => void }) => {
  return () => (
    <div class="stars">
      {STARS.map(star => (
        <button
          key={star}
          type="button"
          data-star={star}
          class={star <= props.rating ? 'on' : ''}
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            props.onRate(star === props.rating ? 0 : star)
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}, { props: ['rating', 'onRate'] })
