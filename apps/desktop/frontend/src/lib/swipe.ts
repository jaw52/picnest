/** Horizontal scroll a swipe has to travel before it counts. */
export const SWIPE_DISTANCE = 40
/** A pause this long between wheel events always ends the gesture. */
export const SWIPE_IDLE_MS = 200

/**
 * Turns a stream of trackpad wheel events into discrete swipes, one per
 * gesture: `push` returns 1 (fingers moved left, i.e. next), -1 (previous)
 * or 0. Once a swipe fires the gesture is locked, so its trailing momentum
 * can't fire again. The lock lifts on a pause, or as soon as a new gesture
 * shows up inside the momentum: momentum only ever decays in one direction,
 * so a reversal or a delta that grows twice in a row means fresh fingers.
 */
export function createSwipeDetector() {
  let dx = 0
  let locked = false
  let lastTime = -Infinity
  let lastDelta = 0
  let rises = 0

  function reset() {
    dx = 0
    locked = false
    rises = 0
  }

  /** Whether `delta`, arriving while locked, is a new gesture rather than momentum. */
  function startsNewGesture(delta: number) {
    if (Math.sign(delta) !== Math.sign(dx))
      return true
    rises = Math.abs(delta) > Math.abs(lastDelta) ? rises + 1 : 0
    return rises >= 2
  }

  return {
    push(deltaX: number, deltaY: number, time: number): -1 | 0 | 1 {
      if (time - lastTime > SWIPE_IDLE_MS)
        reset()
      lastTime = time
      const horizontal = Math.abs(deltaX) > Math.abs(deltaY)
      const delta = horizontal ? deltaX : 0
      if (locked && delta !== 0 && startsNewGesture(delta))
        reset()
      lastDelta = delta
      if (locked || !horizontal)
        return 0
      // A change of direction before the threshold starts the count over.
      dx = Math.sign(delta) === Math.sign(dx) ? dx + delta : delta
      if (Math.abs(dx) < SWIPE_DISTANCE)
        return 0
      locked = true
      return dx > 0 ? 1 : -1
    },
  }
}
