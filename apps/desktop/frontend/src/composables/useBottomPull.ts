import type { MotionValue } from 'motion-v'
import type { MaybeRefOrGetter } from 'vue'
import { animate, useMotionValue } from 'motion-v'
import { onScopeDispose, toValue, watch } from 'vue'
import { spring } from '~/lib/springs'

/** How hard the end of the grid can be pushed against, in px of arc. */
export const PULL_MAX = 96
/** Wheel quiet for this long means the pull was let go. */
const RELEASE_MS = 140
/**
 * A wheel pause this long at the bottom marks a fresh try. The scroll that
 * reaches the end - and its momentum - shows nothing; scrolling again to
 * check whether more is coming is what gets the answer.
 */
const RETRY_GAP_MS = 250
/** Px per line, for wheels that report lines rather than pixels. */
const LINE_HEIGHT = 16

function atBottom(scroller: HTMLElement): boolean {
  return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
}

/**
 * How hard the end of the grid is pushed against: wheel scrolling on once
 * `scroller` is at its bottom adds to it, against growing resistance, and
 * it springs back when the wheel goes quiet. A trackpad fling that runs into the
 * end shows nothing, though: only another try after it does (RETRY_GAP_MS).
 *
 * The listener is passive: a cancelable one would hold up every scroll (see
 * useThumbnailPinch), and at the bottom there is nothing left to cancel.
 */
export function useBottomPull(
  enabled: MaybeRefOrGetter<boolean>,
  scroller: MaybeRefOrGetter<HTMLElement | null>,
): MotionValue<number> {
  const pull = useMotionValue(0)
  onScopeDispose(() => pull.destroy())

  watch(() => [toValue(enabled), toValue(scroller)] as const, ([on, el], _, onCleanup) => {
    if (!on || !el)
      return
    // The wheel distance taken in, before resistance.
    let raw = 0
    let release = 0
    let settling: ReturnType<typeof animate> | null = null
    // Whether this run of wheeling at the bottom began after a pause there.
    let retrying = false
    let lastWheel = -Infinity

    function settle() {
      window.clearTimeout(release)
      raw = 0
      settling = animate(pull, 0, spring.slow)
    }
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || (e.target instanceof Element && e.target.closest('[role="dialog"]')))
        return
      const now = performance.now()
      const sincePrevious = now - lastWheel
      lastWheel = now
      if (e.deltaY <= 0 || !atBottom(el!)) {
        retrying = false
        if (pull.get() > 0)
          settle()
        return
      }
      retrying ||= sincePrevious > RETRY_GAP_MS
      if (!retrying)
        return
      if (settling) {
        settling.stop()
        settling = null
        // Pick up from wherever the spring back had got to.
        raw = -PULL_MAX * Math.log(1 - pull.get() / PULL_MAX)
      }
      raw += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * LINE_HEIGHT : e.deltaY
      pull.set(PULL_MAX * (1 - Math.exp(-raw / PULL_MAX)))
      window.clearTimeout(release)
      release = window.setTimeout(settle, RELEASE_MS)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    onCleanup(() => {
      window.removeEventListener('wheel', onWheel)
      window.clearTimeout(release)
      settling?.stop()
      pull.set(0)
    })
  }, { immediate: true })

  return pull
}
