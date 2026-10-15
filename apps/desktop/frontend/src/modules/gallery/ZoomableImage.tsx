import type { SyntheticEvent } from 'react'
import type { ContextMenuItem } from '~/components/ContextMenu'
import type { View } from '~/lib/zoom'
import * as stylex from '@stylexjs/stylex'
import { motion } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import LoadingRegular from '~icons/mingcute/loading-line'
import { ContextMenu } from '~/components/ContextMenu'
import { spring } from '~/lib/springs'
import { actualSizeScale, clampView, FIT, zoomAbout } from '~/lib/zoom'

/** Height kept clear above the photo: the title bar row, where the traffic lights sit. */
const TITLEBAR_STRIP = 40
/** Height reserved under the photo for the filmstrip and the caption above it, and a gap. */
const CAPTION_STRIP = 112
/** Width kept clear on each side for the previous/next buttons: their 16px offset, 36px size, and a gap. */
const BUTTON_STRIP = 64
/** Movement under this is a click, not a drag. */
const DRAG_THRESHOLD = 3
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

/** The photo itself, and its size as stored, when `src` is a scaled copy of it. */
export interface FullImage {
  src: string
  width: number
  height: number
}

interface ZoomableImageProps {
  src: string
  /** Loaded over `src` once zoomed in, and what actual size means. */
  full?: FullImage
  /** Shown while `src` loads, with a spinner over it. */
  placeholder?: Placeholder
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
export function ZoomableImage({ src, full, placeholder, alt, fadeIn, menuItems }: ZoomableImageProps) {
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

  function updateView(next: View, animated = false) {
    viewRef.current = next
    setSmooth(animated)
    setView(next)
  }

  /** The photo's own width in pixels, however large `src` is. */
  function photoWidth(image: HTMLImageElement) {
    if (!full)
      return image.naturalWidth
    // Its size is as stored: a photo turned upright by its EXIF
    // orientation shows it the other way round.
    const landscape = image.offsetWidth >= image.offsetHeight
    return landscape === (full.width >= full.height) ? full.width : full.height
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
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          e.stopPropagation()
        }
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
              dragging ? styles.dragging : zoomed ? styles.zoomed : styles.fit,
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
              {...stylex.props(styles.image, styles.over, styles.passThrough, !fullLoaded && styles.unloaded)}
              draggable={false}
            />
          )}
          {placeholder && !loaded && <LoadingRegular width={24} height={24} {...stylex.props(styles.spinner)} />}
        </div>
      </ContextMenu>
    </div>
  )
}
