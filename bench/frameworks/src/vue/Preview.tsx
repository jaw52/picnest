import type { Photo } from '../shared/types.ts'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { decodeWindow, filmScrollFor, flatColor, frameWidth } from '../shared/gallery.ts'
import { ImageDecoder } from '../shared/harness.ts'
import { FILM_STEP, filmRange } from '../shared/masonry.ts'

interface PreviewProps {
  photos: Photo[]
  index: number
  onPick: (id: string) => void
}

export const Preview = defineComponent((props: PreviewProps) => {
  const decoder = new ImageDecoder()
  watchEffect(() => {
    const srcs = decodeWindow(props.photos, props.index)
    srcs.forEach(src => decoder.decode(src))
    decoder.retain(srcs)
  })

  return () => {
    const { photos, index } = props
    const photo = photos[index]
    return (
      <div class="preview">
        {/* The neighbours sit either side, ready to slide in. */}
        {photos[index - 1] && <Page key={photos[index - 1].id} photo={photos[index - 1]} place="before" />}
        <Page key={photo.id} photo={photo} place="" />
        {photos[index + 1] && <Page key={photos[index + 1].id} photo={photos[index + 1]} place="after" />}
        <div class="caption">
          <span class="name">{photo.name}</span>
          <span class="count">
            {index + 1}
            {' / '}
            {photos.length}
          </span>
        </div>
        <Filmstrip photos={photos} index={index} onPick={props.onPick} />
      </div>
    )
  }
}, { props: ['photos', 'index', 'onPick'] })

const Page = defineComponent((props: { photo: Photo, place: string }) => {
  return () => {
    const { photo } = props
    return (
      <div class={`page ${props.place}`}>
        <div class="frame" style={{ width: frameWidth(photo.aspectRatio), aspectRatio: photo.aspectRatio }}>
          {photo.full
            ? (
                <>
                  <img src={photo.thumb} alt="" />
                  <img class="full" src={photo.full} alt="" decoding="async" />
                </>
              )
            : <div class="flat" style={{ background: flatColor(photo) }} />}
        </div>
      </div>
    )
  }
}, { props: ['photo', 'place'] })

const Filmstrip = defineComponent((props: PreviewProps) => {
  const strip = ref<HTMLDivElement>()
  const scroll = ref({ left: filmScrollFor(props.index, FILM_STEP), width: window.innerWidth })

  watch(() => props.index, (index) => {
    strip.value!.scrollLeft = filmScrollFor(index, FILM_STEP)
  }, { flush: 'post' })

  let frame = 0
  function onScroll() {
    frame ||= requestAnimationFrame(() => {
      frame = 0
      scroll.value = { left: strip.value!.scrollLeft, width: strip.value!.clientWidth }
    })
  }
  onMounted(() => {
    strip.value!.scrollLeft = filmScrollFor(props.index, FILM_STEP)
    onScroll()
    strip.value!.addEventListener('scroll', onScroll, { passive: true })
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    strip.value?.removeEventListener('scroll', onScroll)
  })

  return () => {
    const { photos, index } = props
    const [first, last] = filmRange(photos.length, scroll.value.left, scroll.value.width)
    const pad = scroll.value.width / 2
    const thumbs = []
    for (let i = first; i <= last; i++) {
      const photo = photos[i]
      thumbs.push(
        <button
          key={photo.id}
          type="button"
          class={i === index ? 'film-thumb current' : 'film-thumb'}
          style={{ left: `${pad + i * FILM_STEP}px` }}
          onClick={() => props.onPick(photo.id)}
        >
          {photo.thumb
            ? <img src={photo.thumb} alt="" decoding="async" />
            : <div class="flat" style={{ background: flatColor(photo) }} />}
        </button>,
      )
    }
    return (
      <div ref={strip} class="film">
        <div class="film-content" style={{ width: `${photos.length * FILM_STEP + scroll.value.width}px` }}>{thumbs}</div>
      </div>
    )
  }
}, { props: ['photos', 'index', 'onPick'] })
