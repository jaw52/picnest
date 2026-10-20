import type { SyntheticEvent } from 'react'
import type { ContextMenuItem } from '~/components/ContextMenu'
import type { View } from '~/lib/zoom'
import * as stylex from '@stylexjs/stylex'
import { motion } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LivePhotoRegular from '~icons/mingcute/live-photo-line'
import LoadingRegular from '~icons/mingcute/loading-line'
import { ContextMenu } from '~/components/ContextMenu'
import { spring } from '~/lib/springs'
import { actualSizeScale, clampView, FIT, zoomAbout } from '~/lib/zoom'
import { motion as motionTokens, radius } from '~/theme/layout.stylex'
import { text } from '~/theme/text'

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
 * scaled copy: past the 200ms zoom animation (styles.smooth), and between a
 * pinch's or a drag's steps.
 */
const VIEW_SETTLE_MS = 250
/** Pinch deltas arrive as small wheel `deltaY`s with ctrl held; this turns them into a zoom factor. */
const WHEEL_ZOOM_RATE = 0.01

const spin = stylex.keyframes({
  to: { transform: 'rotate(360deg)' },
})

const styles = stylex.create({
  // Fills the overlay. The padding leaves the traffic lights, and the caption
  // and filmstrip, strips of their own, so a tall photo is fitted between
  // them instead of running underneath.
  viewport: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    overflow: 'hidden',
    boxSizing: 'border-box',
    paddingTop: TITLEBAR_STRIP,
    paddingBottom: CAPTION_STRIP,
    touchAction: 'none',
  },
  stage: { position: 'relative', margin: 'auto', transformOrigin: 'center' },
  smooth: { transitionProperty: 'transform', transitionDuration: '200ms', transitionTimingFunction: 'ease-out' },
  image: {
    display: 'block',
    maxHeight: `calc(100vh - ${TITLEBAR_STRIP + CAPTION_STRIP}px)`,
    maxWidth: `calc(100vw - ${2 * BUTTON_STRIP}px)`,
    objectFit: 'contain',
  },
  // The photo's fitted box, worked out from its size since the placeholder
  // has too few pixels to set it: no larger than the photo, nor than the
  // room the image style leaves it.
  placeholderBox: (width: number, height: number) => ({
    width: `min(${width}px, calc(100vw - ${2 * BUTTON_STRIP}px), calc((100vh - ${TITLEBAR_STRIP + CAPTION_STRIP}px) * ${width / height}))`,
    aspectRatio: `${width} / ${height}`,
  }),
  // The photo over its placeholder, unseen until it has loaded.
  over: { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none' },
  unloaded: { visibility: 'hidden' },
  // The full-size photo over the scaled copy, leaving clicks to the copy.
  passThrough: { pointerEvents: 'none' },
  spinner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
    pointerEvents: 'none',
    color: 'white',
    filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))',
    animationName: spin,
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  // A Live Photo's video over the photo, faded in once it plays.
  video: {
    opacity: 0,
    transitionProperty: 'opacity',
    transitionDuration: motionTokens.fast,
  },
  videoPlaying: { opacity: 1 },
  // Marks a Live Photo in its corner; hovering it plays the video.
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingInline: 8,
    paddingBlock: 2,
    backgroundColor: 'rgb(0 0 0 / 0.45)',
    color: 'white',
    cursor: 'default',
    userSelect: 'none',
  },
  liveSpinner: {
    animationName: spin,
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  fit: { cursor: 'zoom-in' },
  zoomed: { cursor: 'grab' },
  dragging: { cursor: 'grabbing' },
})

interface WebKitGestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

/** A smaller picture of a photo, and the photo's size, to show while the photo loads. */
export interface Placeholder {
  src: string
  width: number
  height: number
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
    onLoad: (e: SyntheticEvent<HTMLImageElement>) => void e.currentTarget.decode().catch(() => {}).then(done),
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
      src={placeholder.src}
      alt=""
      draggable={false}
      {...stylex.props(styles.image, styles.placeholderBox(placeholder.width, placeholder.height))}
    />
  )
}

/** The photo itself, and its width in pixels, when `src` is a scaled copy of it. */
export interface FullImage {
  src: string
  width: number
}

/** The video of a Live Photo, and whether it plays over and over (a loop or a bounce). */
export interface LiveVideo {
  src: string
  loop: boolean
}

interface ZoomableImageProps {
  src: string
  /** Loaded over `src` once zoomed in, and what actual size means. */
  full?: FullImage
  /** Shown while `src` loads, with a spinner over it. */
  placeholder?: Placeholder
  /** Played over the photo: once through while its badge is hovered, or over and over. */
  live?: LiveVideo
  alt: string
  /** Fade and scale the photo in on mount; off when it replaces another. */
  fadeIn: boolean
  menuItems: ContextMenuItem[]
}

/**
 * A photo laid out as the lightbox fits it, without the zoom: a neighbour
 * waiting beside the photo shown, for a swipe to bring in.
 */
export function FittedImage({ src, placeholder, alt }: { src: string, placeholder?: Placeholder, alt: string }) {
  const { loaded, ...loadHandlers } = useLoaded(src)
  return (
    <div {...stylex.props(styles.viewport)}>
      <div {...stylex.props(styles.stage)}>
        {placeholder && <PlaceholderImage placeholder={placeholder} />}
        {/* WebKit decodes a large photo off the main thread the first time it
            paints, leaving it blank meanwhile: a neighbour offscreen until a
            swipe slides it in would come in empty. */}
        <img
          src={src}
          alt={alt}
          decoding="sync"
          {...loadHandlers}
          {...stylex.props(styles.image, placeholder && styles.over, placeholder && !loaded && styles.unloaded)}
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
  const dragRef = useRef<{ x: number, y: number, view: View, moved: boolean } | null>(null)
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
    if (!viewport || !stage || !image)
      return null
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
    if (!m)
      return
    updateView(
      zoomAbout(viewRef.current, scale, clientX - m.centerX, clientY - m.centerY, m.box, m.max),
      animated,
    )
  }

  // Native listeners (React's are passive, which can't cancel a wheel event),
  // wired through effect events so they always see the latest handlers.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    // Stops the page scrolling, or WebKit zooming the whole page.
    e.preventDefault()
    // At fit, a plain two-finger scroll is left to bubble up to the
    // lightbox, which turns a horizontal swipe into the next or previous photo.
    if (gestureRef.current || e.ctrlKey || viewRef.current.scale > 1)
      e.stopPropagation()
    if (gestureRef.current)
      return
    if (e.ctrlKey) {
      zoomTo(viewRef.current.scale * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE), e.clientX, e.clientY)
      return
    }
    if (viewRef.current.scale <= 1)
      return
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
    if (gestureRef.current)
      zoomTo(gestureRef.current.base * g.scale, g.clientX, g.clientY)
  })
  const onGestureEnd = useEffectEvent((e: Event) => {
    e.preventDefault()
    gestureRef.current = null
  })

  useEffect(() => {
    const el = viewportRef.current
    if (!el)
      return
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
  if (zoomed && full && !wantFull)
    setWantFull(true)
  const [fullShown, setFullShown] = useState(false)
  if (fullLoaded && !moving && !fullShown)
    setFullShown(true)
  const liveVideo = useLiveVideo(live, zoomed)

  return (
    <div
      ref={viewportRef}
      {...stylex.props(styles.viewport)}
      onPointerDown={(e) => {
        if (e.button !== 0 || !zoomed)
          return
        suppressClickRef.current = false
        dragRef.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false }
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d)
          return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD)
          return
        if (!d.moved) {
          // Captured only once it is a drag: capturing on press would
          // redirect a plain click from the photo to the viewport.
          e.currentTarget.setPointerCapture(e.pointerId)
          d.moved = true
          setDragging(true)
        }
        const m = measure()
        if (m)
          updateView(clampView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy }, m.box))
      }}
      onPointerUp={() => {
        // A drag that ends over the backdrop must not close the lightbox.
        suppressClickRef.current = dragRef.current?.moved ?? false
        dragRef.current = null
        setDragging(false)
      }}
      onClickCapture={(e) => {
        if (!suppressClickRef.current) {
          return
        }

        suppressClickRef.current = false
        e.stopPropagation()
      }}
    >
      <ContextMenu items={menuItems}>
        <div
          ref={stageRef}
          className={stylex.props(styles.stage, smooth && styles.smooth).className}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {placeholder && <PlaceholderImage placeholder={placeholder} />}
          <motion.img
            ref={imageRef}
            src={src}
            alt={alt}
            decoding="sync"
            {...loadHandlers}
            {...stylex.props(
              styles.image,
              placeholder && styles.over,
              placeholder && !loaded && styles.unloaded,
              dragging ? styles.dragging : (zoomed ? styles.zoomed : styles.fit),
            )}
            draggable={false}
            initial={fadeIn ? { opacity: 0, scale: 0.98 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.slow}
            onClick={(e) => {
              e.stopPropagation()
              const m = measure()
              if (!m)
                return
              if (zoomed)
                updateView(FIT, true)
              else
                zoomTo(m.actual, e.clientX, e.clientY, true)
            }}
          />
          {wantFull && full && (
            <img
              src={full.src}
              alt=""
              {...fullLoadHandlers}
              {...stylex.props(styles.image, styles.over, styles.passThrough, !fullShown && styles.unloaded)}
              draggable={false}
            />
          )}
          {live && liveVideo.video}
          {placeholder && !loaded && <LoadingRegular width={24} height={24} {...stylex.props(styles.spinner)} />}
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
    if (!video)
      return
    if (zoomed) {
      video.pause()
    }
    else if (loop) {
      video.play().catch(() => {})
    }
  }, [zoomed, loop])

  function play() {
    const video = videoRef.current
    if (!video)
      return
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
      ref={videoRef}
      src={live.src}
      muted={live.loop}
      playsInline
      loop={live.loop}
      preload="auto"
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false)
        setWanted(false)
      }}
      {...stylex.props(styles.image, styles.over, styles.passThrough, styles.video, playing && styles.videoPlaying)}
    />
  )
  const badge = (
    <span
      role="presentation"
      {...stylex.props(styles.liveBadge, text.caption)}
      onPointerEnter={play}
      onPointerLeave={stop}
      onClick={e => e.stopPropagation()}
    >
      {wanted && !playing
        ? <LoadingRegular width={14} height={14} {...stylex.props(styles.liveSpinner)} />
        : <LivePhotoRegular width={14} height={14} />}
      {t('preview.live')}
    </span>
  )
  return { video, badge }
}
