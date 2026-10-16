import type { Photo } from '../shared/types.ts'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { decodeWindow, filmScrollFor, flatColor, frameWidth } from '../shared/gallery.ts'
import { ImageDecoder } from '../shared/harness.ts'
import { FILM_STEP, filmRange } from '../shared/masonry.ts'

interface PreviewProps {
  photos: Photo[]
  index: number
  onPick: (id: string) => void
}

export function Preview(props: PreviewProps) {
  const decoder = new ImageDecoder()
  createEffect(() => {
    const srcs = decodeWindow(props.photos, props.index)
    srcs.forEach(src => decoder.decode(src))
    decoder.retain(srcs)
  })

  const photo = () => props.photos[props.index]
  // The photo and its neighbours, keyed by photo so a switch only moves them.
  const pages = createMemo(() => [-1, 0, 1].map(offset => props.photos[props.index + offset]).filter(Boolean))
  function place(page: Photo) {
    const current = photo()
    if (page === current)
      return ''
    return pages().indexOf(page) < pages().indexOf(current) ? 'before' : 'after'
  }

  return (
    <div class="preview">
      <For each={pages()}>
        {page => <Page photo={page} place={place(page)} />}
      </For>
      <div class="caption">
        <span class="name">{photo().name}</span>
        <span class="count">
          {props.index + 1}
          {' / '}
          {props.photos.length}
        </span>
      </div>
      <Filmstrip photos={props.photos} index={props.index} onPick={props.onPick} />
    </div>
  )
}

function Page(props: { photo: Photo, place: string }) {
  return (
    <div class={`page ${props.place}`}>
      <div class="frame" style={{ 'width': frameWidth(props.photo.aspectRatio), 'aspect-ratio': props.photo.aspectRatio }}>
        <Show when={props.photo.full} fallback={<div class="flat" style={{ background: flatColor(props.photo) }} />}>
          <img src={props.photo.thumb} alt="" />
          <img class="full" src={props.photo.full} alt="" decoding="async" />
        </Show>
      </div>
    </div>
  )
}

function Filmstrip(props: PreviewProps) {
  let strip!: HTMLDivElement
  const [scroll, setScroll] = createSignal({ left: filmScrollFor(props.index, FILM_STEP), width: window.innerWidth })

  createEffect(() => {
    strip.scrollLeft = filmScrollFor(props.index, FILM_STEP)
  })
  onMount(() => {
    let frame = 0
    function onScroll() {
      frame ||= requestAnimationFrame(() => {
        frame = 0
        setScroll({ left: strip.scrollLeft, width: strip.clientWidth })
      })
    }
    onScroll()
    strip.addEventListener('scroll', onScroll, { passive: true })
    onCleanup(() => {
      cancelAnimationFrame(frame)
      strip.removeEventListener('scroll', onScroll)
    })
  })

  const range = createMemo(() => {
    const [first, last] = filmRange(props.photos.length, scroll().left, scroll().width)
    const out: number[] = []
    for (let i = first; i <= last; i++)
      out.push(i)
    return out
  })
  const pad = () => scroll().width / 2
  const thumbs = createMemo(() => range().map(i => props.photos[i]))

  return (
    <div ref={strip} class="film">
      <div class="film-content" style={{ width: `${props.photos.length * FILM_STEP + scroll().width}px` }}>
        <For each={thumbs()}>
          {(photo, k) => {
            const i = () => range()[k()]
            return (
              <button
                type="button"
                class="film-thumb"
                classList={{ current: i() === props.index }}
                style={{ left: `${pad() + i() * FILM_STEP}px` }}
                onClick={() => props.onPick(photo.id)}
              >
                {photo.thumb
                  ? <img src={photo.thumb} alt="" decoding="async" />
                  : <div class="flat" style={{ background: flatColor(photo) }} />}
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}
