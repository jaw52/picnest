import { useSetAtom, useStore } from 'jotai'
import { useEffect } from 'react'
import { THUMBNAIL_WIDTH_MAX, THUMBNAIL_WIDTH_MIN, thumbnailWidthAtom } from '~/atoms/gallery'

/** Pinch deltas arrive as small wheel `deltaY`s with ctrl held; this turns them into a scale factor. */
const WHEEL_ZOOM_RATE = 0.01
/** The thumbnail slider's step, which pinched widths snap to as well. */
const WIDTH_STEP = 10

interface WebKitGestureEvent extends UIEvent {
  scale: number
}

function clampWidth(width: number) {
  const snapped = Math.round(width / WIDTH_STEP) * WIDTH_STEP
  return Math.min(THUMBNAIL_WIDTH_MAX, Math.max(THUMBNAIL_WIDTH_MIN, snapped))
}

/**
 * Pinching the grid resizes the thumbnails, as in Photos. Pinch arrives as
 * `gesture*` events in WebKit (the macOS webview) and as ctrl+wheel in
 * Chromium; both are handled, and kept from zooming the page.
 */
export function useThumbnailPinch(enabled: boolean) {
  const store = useStore()
  const setWidth = useSetAtom(thumbnailWidthAtom)

  useEffect(() => {
    if (!enabled)
      return
    let base: number | null = null
    // Unsnapped width through a ctrl+wheel pinch, whose many small deltas
    // would each round away to nothing.
    let wheelWidth: number | null = null
    let wheelIdle = 0
    function onGestureStart(e: Event) {
      e.preventDefault()
      base = store.get(thumbnailWidthAtom)
    }
    function onGestureChange(e: Event) {
      e.preventDefault()
      if (base !== null)
        setWidth(clampWidth(base * (e as WebKitGestureEvent).scale))
    }
    function onGestureEnd(e: Event) {
      e.preventDefault()
      base = null
    }
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey)
        return
      e.preventDefault()
      if (base !== null)
        return
      wheelWidth = Math.min(
        THUMBNAIL_WIDTH_MAX,
        Math.max(THUMBNAIL_WIDTH_MIN, (wheelWidth ?? store.get(thumbnailWidthAtom)) * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE)),
      )
      setWidth(clampWidth(wheelWidth))
      window.clearTimeout(wheelIdle)
      wheelIdle = window.setTimeout(() => {
        wheelWidth = null
      }, 200)
    }
    document.addEventListener('gesturestart', onGestureStart)
    document.addEventListener('gesturechange', onGestureChange)
    document.addEventListener('gestureend', onGestureEnd)
    // Only where pinch isn't a gesture event: a cancelable wheel listener
    // makes WebKit wait on the main thread before scrolling, so the grid's
    // renders while scrolling would stall the scroll itself.
    const pinchIsWheel = !('GestureEvent' in window)
    if (pinchIsWheel)
      window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('gesturestart', onGestureStart)
      document.removeEventListener('gesturechange', onGestureChange)
      document.removeEventListener('gestureend', onGestureEnd)
      if (pinchIsWheel)
        window.removeEventListener('wheel', onWheel)
      window.clearTimeout(wheelIdle)
    }
  }, [enabled, store, setWidth])
}
