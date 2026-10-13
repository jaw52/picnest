import { WheelGestures } from 'wheel-gestures'

/** Horizontal travel within one gesture before it counts as a swipe. */
export const SWIPE_DISTANCE = 40

/**
 * Turns a stream of trackpad wheel events into discrete swipes, one per
 * gesture: `push` returns 1 (fingers moved left, i.e. next), -1 (previous)
 * or 0. wheel-gestures tells where each gesture starts, its momentum
 * included, so a swipe fires once its horizontal travel reaches
 * SWIPE_DISTANCE and not again until fresh fingers start a new gesture.
 */
export function createSwipeDetector() {
  // Fed by hand rather than observing an element: the caller decides which
  // events are its to handle, and has already prevented the default.
  const gestures = WheelGestures({ preventWheelAction: false })
  let fired = false
  let result: -1 | 0 | 1 = 0

  gestures.on('wheel', (state) => {
    if (state.isStart)
      fired = false
    if (fired || state.isEnding)
      return
    const [x, y] = state.axisMovement
    if (Math.abs(x) < SWIPE_DISTANCE || Math.abs(x) <= Math.abs(y))
      return
    fired = true
    // Movement runs against the deltas (it is what the content would do),
    // so fingers moving left - positive deltaX - move it negative.
    result = x < 0 ? 1 : -1
  })

  return {
    push(event: Pick<WheelEvent, 'deltaMode' | 'deltaX' | 'deltaY' | 'timeStamp'>): -1 | 0 | 1 {
      result = 0
      // Listeners run synchronously, so `result` is this event's verdict.
      gestures.feedWheel(event)
      return result
    },
  }
}
