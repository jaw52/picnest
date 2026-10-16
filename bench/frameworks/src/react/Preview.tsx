import type { Photo } from '../shared/types.ts'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { decodeWindow, filmScrollFor, flatColor, frameWidth } from '../shared/gallery.ts'
import { ImageDecoder } from '../shared/harness.ts'
import { FILM_STEP, filmRange } from '../shared/masonry.ts'

interface PreviewProps {
  photos: Photo[]
  index: number
  onPick: (id: string) => void
}

export function Preview({ photos, index, onPick }: PreviewProps) {
  const [decoder] = useState(() => new ImageDecoder())
  useEffect(() => {
    const srcs = decodeWindow(photos, index)
    srcs.forEach(src => decoder.decode(src))
    decoder.retain(srcs)
  }, [photos, index, decoder])

  const photo = photos[index]
  return (
    <div className="preview">
      {/* The neighbours sit either side, ready to slide in. */}
      {photos[index - 1] && <Page key={photos[index - 1].id} photo={photos[index - 1]} place="before" />}
      <Page key={photo.id} photo={photo} place="" />
      {photos[index + 1] && <Page key={photos[index + 1].id} photo={photos[index + 1]} place="after" />}
      <div className="caption">
        <span className="name">{photo.name}</span>
        <span className="count">
          {index + 1}
          {' / '}
          {photos.length}
        </span>
      </div>
      <Filmstrip photos={photos} index={index} onPick={onPick} />
    </div>
  )
}

function Page({ photo, place }: { photo: Photo, place: string }) {
  return (
    <div className={`page ${place}`}>
      <div className="frame" style={{ width: frameWidth(photo.aspectRatio), aspectRatio: photo.aspectRatio }}>
        {photo.full
          ? (
              <>
                <img src={photo.thumb} alt="" />
                <img className="full" src={photo.full} alt="" decoding="async" />
              </>
            )
          : <div className="flat" style={{ background: flatColor(photo) }} />}
      </div>
    </div>
  )
}

function Filmstrip({ photos, index, onPick }: PreviewProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ left: filmScrollFor(index, FILM_STEP), width: window.innerWidth })

  useLayoutEffect(() => {
    stripRef.current!.scrollLeft = filmScrollFor(index, FILM_STEP)
  }, [index])
  useEffect(() => {
    const strip = stripRef.current!
    let frame = 0
    function onScroll() {
      frame ||= requestAnimationFrame(() => {
        frame = 0
        setScroll({ left: strip.scrollLeft, width: strip.clientWidth })
      })
    }
    onScroll()
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      strip.removeEventListener('scroll', onScroll)
    }
  }, [])

  const [first, last] = filmRange(photos.length, scroll.left, scroll.width)
  const pad = scroll.width / 2
  const thumbs = []
  for (let i = first; i <= last; i++) {
    const photo = photos[i]
    thumbs.push(
      <button
        key={photo.id}
        type="button"
        className={i === index ? 'film-thumb current' : 'film-thumb'}
        style={{ left: pad + i * FILM_STEP }}
        onClick={() => onPick(photo.id)}
      >
        {photo.thumb
          ? <img src={photo.thumb} alt="" decoding="async" />
          : <div className="flat" style={{ background: flatColor(photo) }} />}
      </button>,
    )
  }
  return (
    <div ref={stripRef} className="film">
      <div className="film-content" style={{ width: photos.length * FILM_STEP + scroll.width }}>{thumbs}</div>
    </div>
  )
}
