/** Travel, in px either way, before a gesture is known to be across or along. */
const AXIS_SLOP = 4
/** A gesture is over once no event has come for this long, in ms. */
const IDLE_MS = 100
/** A pause this long, in ms, after a swipe may be fresh fingers on the pad. */
const NEW_GESTURE_GAP_MS = 30
/** Fresh fingers start from a standstill: the low after the pause is this small. */
const NEW_GESTURE_LOW = 4
/** How much a delta must grow past that low to be fresh fingers. */
const NEW_GESTURE_RISE = 4
/** Pulling past the first or last page moves the photo this fraction of the way. */
const RUBBER_BAND = 0.25

export type PageDirection = -1 | 1

interface SwipePagerOptions {
  /** Travel, in px, that turns a drag into a page turn. */
  distance: () => number
  canPage: (direction: PageDirection) => boolean
  /** The photo follows the fingers: how far it has moved, negative to the left. */
  follow: (offset: number) => void
  /** Turn the page: 1 for the next photo, -1 for the previous. */
  commit: (direction: PageDirection) => void
  /** A page turn is still sliding in: fresh fingers wait for it to land. */
  turning: () => boolean
  /** The gesture ended short of a page turn: settle back. */
  release: () => void
}

type WheelSample = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'timeStamp'>

export type SwipePager = ReturnType<typeof createSwipePager>

/**
 * Pages through photos with two-finger trackpad swipes, the photo following
 * the fingers. WebKit's wheel events don't say where a gesture or its
 * momentum begins, so this reads it from the deltas: a gesture ends after a
 * pause; once it has turned a page, the rest of it - the fingers still
 * moving, then the momentum - is swallowed, unless a pause, a near
 * standstill and then a rising delta show fresh fingers starting another
 * swipe.
 */
export function createSwipePager(options: SwipePagerOptions) {
  let state: 'idle' | 'following' | 'settled' | 'ignoring' = 'idle'
  let startX = 0
  let startY = 0
  let offset = 0
  // While settled or ignoring: whether a pause has come that fresh fingers
  // would follow, and the smallest delta since.
  let low = Infinity
  let paused = false
  let lastTime = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function direction(): PageDirection {
    // Content moved left shows the next photo.
    return offset < 0 ? 1 : -1
  }

  function follow(deltaX: number) {
    offset -= deltaX
    const dir = direction()
    if (!options.canPage(dir)) {
      options.follow(offset * RUBBER_BAND)
      return
    }
    if (Math.abs(offset) >= options.distance()) {
      settle()
      options.commit(dir)
      return
    }
    options.follow(offset)
  }

  function settle(next: 'settled' | 'ignoring' = 'settled') {
    state = next
    low = Infinity
    paused = false
  }

  function start(e: WheelSample) {
    startX += e.deltaX
    startY += e.deltaY
    if (Math.abs(startX) + Math.abs(startY) < AXIS_SLOP)
      return
    if (Math.abs(startY) > Math.abs(startX)) {
      settle('ignoring')
      return
    }
    state = 'following'
    offset = 0
    follow(startX)
  }

  function end() {
    if (state === 'following')
      options.release()
    state = 'idle'
    startX = 0
    startY = 0
  }

  return {
    push(e: WheelSample) {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(end, IDLE_MS)
      const gap = e.timeStamp - lastTime
      lastTime = e.timeStamp

      if (state === 'settled' || state === 'ignoring') {
        const delta = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY))
        if (gap >= NEW_GESTURE_GAP_MS) {
          paused = true
          low = Infinity
        }
        // The fingers that turned the page may still be moving, speeding up
        // and pausing as they go: only a rise from a standstill is new.
        if (!paused || low > NEW_GESTURE_LOW || delta < low + NEW_GESTURE_RISE || options.turning()) {
          low = Math.min(low, delta)
          return
        }
        state = 'idle'
        startX = 0
        startY = 0
      }
      if (state === 'idle')
        start(e)
      else
        follow(e.deltaX)
    },
    dispose() {
      clearTimeout(idleTimer)
    },
  }
}
