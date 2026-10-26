import { motion } from 'motion/react'
import type { SyntheticEvent } from 'react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ContextMenuItem } from '~/components/ContextMenu'
import { ContextMenu } from '~/components/ContextMenu'
import { cn } from '~/lib/cn'
import { spring } from '~/lib/springs'
import type { View } from '~/lib/zoom'
import { actualSizeScale, clampView, FIT, zoomAbout } from '~/lib/zoom'
import LivePhotoRegular from '~icons/mingcute/live-photo-line'
import LoadingRegular from '~icons/mingcute/loading-line'

/** Height kept clear above the photo: the title bar row, where the traffic lights sit. */
const TITLEBAR_STRIP = 40
/** Height reserved under the photo for the filmstrip and the caption above it, and a gap. */
const CAPTION_STRIP = 112
/** Width kept clear on each side for the previous/next buttons: their 16px offset, 36px size, and a gap. */
const BUTTON_STRIP = 64
/** Movement under this is a click, not a drag. */
const DRAG_THRESHOLD = 3
/**
 * How long the view stays still before the full-size photo shows over the
 * scaled copy: past the 200ms zoom animation (duration-200 on the stage), and between a
 * pinch's or a drag's steps.
 */
const VIEW_SETTLE_MS = 250
/** Pinch deltas arrive as small wheel `deltaY`s with ctrl held; this turns them into a zoom factor. */
const WHEEL_ZOOM_RATE = 0.01

// Fills the overlay. The padding (40px) leaves the traffic lights, and the
// caption and filmstrip (112px), strips of their own, so a tall photo is fitted
// between them instead of running underneath.
const VIEWPORT_CLASS = 'absolute inset-0 box-border flex touch-none overflow-hidden pt-10 pb-28'
// 152px is those two strips together; 128px, the room kept for the buttons.
const IMAGE_CLASS = 'block max-h-[calc(100vh-152px)] max-w-[calc(100vw-128px)] object-contain'
// The photo over its placeholder, unseen until it has loaded.
const OVER_CLASS = 'absolute inset-0 size-full max-h-none max-w-none'
// The full-size photo over the scaled copy, leaving clicks to the copy.
const PASS_THROUGH_CLASS = 'pointer-events-none'

interface WebKitGestureEvent extends UIEvent {
  clientX: number
  clientY: number
  scale: number
}

/** A smaller picture of a photo, and the photo's size, to show while the photo loads. */
export interface Placeholder {
  height: number
  src: string
  width: number
}

/**
 * Whether `src` has loaded (or failed to: the placeholder then gives way, to
 * show that it failed). The photo's own element reports it, so the load is
 * the one that paints.
 */
function useLoaded(src: string) {
  const [loaded, setLoaded] = useState<string | null>(null)
  const done = () => setLoaded(src)
  return {
    loaded: loaded === src,
    // Decoded off the main thread before it shows: shown as soon as it
    // loads, a large photo would decode on it (decoding="sync") and hold up
    // the page, a switch to the next photo included.
    onLoad: (e: SyntheticEvent<HTMLImageElement>) =>
      void e.currentTarget
        .decode()
        .catch(() => {})
        .then(done),
    onError: done,
  }
}

/**
 * The placeholder, as large as the photo will show: its own pixels are far
 * fewer. The photo goes over it, filling the same box.
 */
function PlaceholderImage({ placeholder }: { placeholder: Placeholder }) {
  return (
    <img
      alt=""
      draggable={false}
      src={placeholder.src}
      className={IMAGE_CLASS}
      // The photo's fitted box, worked out from its size since the placeholder
      // has too few pixels to set it: no larger than the photo, nor than the
      // room the image classes leave it.
      style={{
        width: `min(${placeholder.width}px, calc(100vw - ${2 * BUTTON_STRIP}px), calc((100vh - ${TITLEBAR_STRIP + CAPTION_STRIP}px) * ${placeholder.width / placeholder.height}))`,
        aspectRatio: `${placeholder.width} / ${placeholder.height}`,
      }}
    />
  )
}

/** The photo itself, and its width in pixels, when `src` is a scaled copy of it. */
interface FullImage {
  src: string
  width: number
}

/** The video of a Live Photo, and whether it plays over and over (a loop or a bounce). */
export interface LiveVideo {
  loop: boolean
  src: string
}

interface ZoomableImageProps {
  alt: string
  /** Fade and scale the photo in on mount; off when it replaces another. */
  fadeIn: boolean
  /** Loaded over `src` once zoomed in, and what actual size means. */
  full?: FullImage
  /** Played over the photo: once through while its badge is hovered, or over and over. */
  live?: LiveVideo
  menuItems: ContextMenuItem[]
  /** Shown while `src` loads, with a spinner over it. */
  placeholder?: Placeholder
  src: string
}

/**
 * A photo laid out as the lightbox fits it, without the zoom: a neighbour
 * waiting beside the photo shown, for a swipe to bring in.
 */
export function FittedImage({ src, placeholder, alt }: { src: string; placeholder?: Placeholder; alt: string }) {
  const { loaded, ...loadHandlers } = useLoaded(src)
  return (
    <div className={VIEWPORT_CLASS}>
      <div className="relative m-auto origin-center">
        {placeholder && <PlaceholderImage placeholder={placeholder} />}
        {/* WebKit decodes a large photo off the main thread the first time it
            paints, leaving it blank meanwhile: a neighbour offscreen until a
            swipe slides it in would come in empty. */}
        <img
          alt={alt}
          decoding="sync"
          src={src}
          {...loadHandlers}
          className={cn(IMAGE_CLASS, placeholder && OVER_CLASS, placeholder && !loaded && 'invisible')}
          draggable={false}
        />
      </div>
    </div>
  )
}

/**
 * The lightbox photo with trackpad zoom: pinch to zoom around the cursor,
 * two-finger scroll to pan once zoomed (at fit it bubbles up, for swiping
 * between photos), drag to pan, click to jump between
 * fit and actual size. Pinch arrives as `gesture*` events in WebKit (the
 * macOS webview) and as ctrl+wheel in Chromium; both are handled.
 */
export function ZoomableImage({ src, full, placeholder, live, alt, fadeIn, menuItems }: ZoomableImageProps) {
  const { loaded, ...loadHandlers } = useLoaded(src)
  const { loaded: fullLoaded, ...fullLoadHandlers } = useLoaded(full?.src ?? '')
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [view, setView] = useState<View>(FIT)
  const [smooth, setSmooth] = useState(false)
  const [dragging, setDragging] = useState(false)
  // The handlers below are native listeners registered once, so they read
  // the latest view from a ref rather than closing over state.
  const viewRef = useRef<View>(FIT)
  const gestureRef = useRef<{ base: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)

  // WebKit stalls a frame for 150-220ms painting a photo of 12 megapixels
  // or more the first time, so the full-size one shows once the view stops
  // moving rather than halting a zoom animation or a pinch midway.
  const [moving, setMoving] = useState(false)
  const settleRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(settleRef.current), [])

  function updateView(next: View, animated = false) {
    viewRef.current = next
    setSmooth(animated)
    setView(next)
    setMoving(true)
    clearTimeout(settleRef.current)
    settleRef.current = setTimeout(setMoving, VIEW_SETTLE_MS, false)
  }

  /** The photo's own width in pixels, however large `src` is. */
  function photoWidth(image: HTMLImageElement) {
    return full?.width ?? image.naturalWidth
  }

  function measure() {
    const viewport = viewportRef.current
    const stage = stageRef.current
    const image = imageRef.current
    if (!viewport || !stage || !image) return null
    const rect = stage.getBoundingClientRect()
    const vRect = viewport.getBoundingClientRect()
    const v = viewRef.current
    return {
      // Where the photo is centered on screen, whatever it is currently scaled or panned to.
      centerX: rect.left + rect.width / 2 - v.x,
      centerY: rect.top + rect.height / 2 - v.y,
      box: {
        imageW: image.offsetWidth,
        imageH: image.offsetHeight,
        viewW: viewport.clientWidth,
        viewH: viewport.clientHeight,
        offsetX: rect.left + rect.width / 2 - v.x - (vRect.left + vRect.width / 2),
        offsetY: rect.top + rect.height / 2 - v.y - (vRect.top + vRect.height / 2),
      },
      max: Math.max(4, actualSizeScale(photoWidth(image), image.offsetWidth) * 4),
      actual: actualSizeScale(photoWidth(image), image.offsetWidth),
    }
  }

  function zoomTo(scale: number, clientX: number, clientY: number, animated = false) {
    const m = measure()
    if (!m) return
    updateView(zoomAbout(viewRef.current, scale, clientX - m.centerX, clientY - m.centerY, m.box, m.max), animated)
  }

  // Native listeners (React's are passive, which can't cancel a wheel event),
  // wired through effect events so they always see the latest handlers.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    // Stops the page scrolling, or WebKit zooming the whole page.
    e.preventDefault()
    // At fit, a plain two-finger scroll is left to bubble up to the
    // lightbox, which turns a horizontal swipe into the next or previous photo.
    if (gestureRef.current || e.ctrlKey || viewRef.current.scale > 1) e.stopPropagation()
    if (gestureRef.current) return
    if (e.ctrlKey) {
      zoomTo(viewRef.current.scale * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE), e.clientX, e.clientY)
      return
    }
    if (viewRef.current.scale <= 1) return
    const m = measure()
    if (m) {
      const { x, y } = viewRef.current
      updateView(clampView({ ...viewRef.current, x: x - e.deltaX, y: y - e.deltaY }, m.box))
    }
  })
  const onGestureStart = useEffectEvent((e: Event) => {
    e.preventDefault()
    gestureRef.current = { base: viewRef.current.scale }
  })
  const onGestureChange = useEffectEvent((e: Event) => {
    e.preventDefault()
    const g = e as WebKitGestureEvent
    if (gestureRef.current) zoomTo(gestureRef.current.base * g.scale, g.clientX, g.clientY)
  })
  const onGestureEnd = useEffectEvent((e: Event) => {
    e.preventDefault()
    gestureRef.current = null
  })

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const wheel = (e: WheelEvent) => onWheel(e)
    const start = (e: Event) => onGestureStart(e)
    const change = (e: Event) => onGestureChange(e)
    const end = (e: Event) => onGestureEnd(e)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('gesturestart', start)
    el.addEventListener('gesturechange', change)
    el.addEventListener('gestureend', end)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('gesturestart', start)
      el.removeEventListener('gesturechange', change)
      el.removeEventListener('gestureend', end)
    }
  }, [])

  const zoomed = view.scale > 1
  // The photo itself loads the first time it's zoomed into, and stays.
  const [wantFull, setWantFull] = useState(false)
  if (zoomed && full && !wantFull) setWantFull(true)
  const [fullShown, setFullShown] = useState(false)
  if (fullLoaded && !moving && !fullShown) setFullShown(true)
  const liveVideo = useLiveVideo(live, zoomed)

  return (
    <div
      className={VIEWPORT_CLASS}
      ref={viewportRef}
      onClickCapture={(e) => {
        if (!suppressClickRef.current) {
          return
        }

        suppressClickRef.current = false
        e.stopPropagation()
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !zoomed) return
        suppressClickRef.current = false
        dragRef.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false }
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d) return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        if (!d.moved) {
          // Captured only once it is a drag: capturing on press would
          // redirect a plain click from the photo to the viewport.
          e.currentTarget.setPointerCapture(e.pointerId)
          d.moved = true
          setDragging(true)
        }
        const m = measure()
        if (m) updateView(clampView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy }, m.box))
      }}
      onPointerUp={() => {
        // A drag that ends over the backdrop must not close the lightbox.
        suppressClickRef.current = dragRef.current?.moved ?? false
        dragRef.current = null
        setDragging(false)
      }}
    >
      <ContextMenu items={menuItems}>
        <div
          className={cn('relative m-auto origin-center', smooth && 'transition-transform duration-200 ease-out')}
          ref={stageRef}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {placeholder && <PlaceholderImage placeholder={placeholder} />}
          <motion.img
            alt={alt}
            decoding="sync"
            ref={imageRef}
            src={src}
            {...loadHandlers}
            animate={{ opacity: 1, scale: 1 }}
            draggable={false}
            initial={fadeIn ? { opacity: 0, scale: 0.98 } : false}
            transition={spring.slow}
            className={cn(
              IMAGE_CLASS,
              placeholder && OVER_CLASS,
              placeholder && !loaded && 'invisible',
              dragging ? 'cursor-grabbing' : zoomed ? 'cursor-grab' : 'cursor-zoom-in',
            )}
            onClick={(e) => {
              e.stopPropagation()
              const m = measure()
              if (!m) return
              if (zoomed) updateView(FIT, true)
              else zoomTo(m.actual, e.clientX, e.clientY, true)
            }}
          />
          {wantFull && full && (
            <img
              alt=""
              src={full.src}
              {...fullLoadHandlers}
              className={cn(IMAGE_CLASS, OVER_CLASS, PASS_THROUGH_CLASS, !fullShown && 'invisible')}
              draggable={false}
            />
          )}
          {live && liveVideo.video}
          {placeholder && !loaded && (
            <LoadingRegular
              className="pointer-events-none absolute top-1/2 left-1/2 -mt-3 -ml-3 animate-spin text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              height={24}
              width={24}
            />
          )}
          {live && !live.loop && !zoomed && liveVideo.badge}
        </div>
      </ContextMenu>
    </div>
  )
}

/**
 * A Live Photo's video, laid over the photo, and the badge that plays it.
 * A loop plays from the start, over and over; a Live Photo plays once
 * through while its badge is hovered, as in Photos. Zoomed in, the photo
 * shows still.
 */
function useLiveVideo(live: LiveVideo | undefined, zoomed: boolean) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  // Asked to play, and playing: it is read from Photos the first time.
  const [wanted, setWanted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const loop = live?.loop ?? false

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (zoomed) {
      video.pause()
    } else if (loop) {
      video.play().catch(() => {})
    }
  }, [zoomed, loop])

  function play() {
    const video = videoRef.current
    if (!video) return
    setWanted(true)
    video.currentTime = 0
    video.play().catch(() => {})
  }
  function stop() {
    setWanted(false)
    videoRef.current?.pause()
  }

  const video = live && (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- a Live Photo's sound is ambient, with nothing to caption
    <video
      playsInline
      loop={live.loop}
      muted={live.loop}
      preload="auto"
      ref={videoRef}
      src={live.src}
      className={cn(
        IMAGE_CLASS,
        OVER_CLASS,
        PASS_THROUGH_CLASS,
        'opacity-0 transition-opacity duration-80',
        playing && 'opacity-100',
      )}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false)
        setWanted(false)
      }}
      // A Live Photo's video over the photo, faded in once it plays.
      onPlaying={() => setPlaying(true)}
    />
  )
  const badge = (
    <span
      onClick={(e) => e.stopPropagation()}
      onPointerEnter={play}
      onPointerLeave={stop}
      role="presentation"
      // Marks a Live Photo in its corner; hovering it plays the video.
      className="absolute top-3 left-3 flex cursor-default items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-caption text-white select-none"
    >
      {wanted && !playing ? (
        <LoadingRegular className="animate-spin" height={14} width={14} />
      ) : (
        <LivePhotoRegular height={14} width={14} />
      )}
      {t('preview.live')}
    </span>
  )
  return { video, badge }
}
