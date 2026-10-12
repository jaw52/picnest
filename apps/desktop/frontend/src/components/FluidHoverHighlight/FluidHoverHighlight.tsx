import type { StyleXStyles } from '@stylexjs/stylex'
import type { Transition } from 'framer-motion'
import type { ItemRect, UseFluidHoverReturn } from '~/hooks/use-fluid-hover'
import * as stylex from '@stylexjs/stylex'
import {
  AnimatePresence,
  motion,

  useReducedMotion,
} from 'framer-motion'
import { spring } from '~/lib/springs'
import { styles } from './style'
import { resolveHighlightSource, resolveHighlightTransition, toTarget } from './utils'

// The hover highlight every fluid hover list renders: an absolutely
// positioned fill that springs between the rects `useFluidHover` measures.
// The container must be `relative`; radius and z-index are the consumer's.

/**
 * What the highlight reads off the hook: the highlighted index, the
 *  measured rects, whether they are current, and the pointer session.
 */
export type FluidHoverSource = Pick<
  UseFluidHoverReturn,
  'activeIndex' | 'itemRects' | 'isMeasured' | 'session'
>

interface HighlightFromHook {
  /**
   * The hook's return value. The highlight sits on
   *  `itemRects[activeIndex]` once `isMeasured`, and re-keys on the session.
   */
  hover: FluidHoverSource
  /**
   * Keep the list's state but show nothing (a closed popup, hover switched
   *  off). Runs the exit fade.
   */
  hidden?: boolean
  rect?: never
  session?: never
}

interface HighlightFromRect {
  /**
   * For lists that resolve their own rect (the sidebar's unified scope):
   *  the rect to sit on, in the container's coordinate space. `null` hides
   *  the highlight (it fades out on `spring.fast.exit`).
   */
  rect: ItemRect | null
  /**
   * `session` from `useFluidHover`. It steps when the cursor enters the
   *  container, which re-keys the highlight so it fades in at `from ?? rect`
   *  instead of sliding over from wherever it was last.
   */
  session: number
  hover?: never
  hidden?: never
}

export type FluidHoverHighlightProps = (HighlightFromHook | HighlightFromRect) & {
  /**
   * Where a fresh session fades in from. A dropdown passes its checked row,
   *  a nav menu its active route. Defaults to the rect itself.
   */
  from?: ItemRect | null
  /**
   * Radius, z-index, anything else. Merged onto the base style
   *  (absolute, hover color, no pointer events).
   */
  xstyle?: StyleXStyles
  /**
   * The positional spring. Defaults to `spring.fast`. Pass `false` to snap
   *  to the new rect with no travel (a layout reflow that moved the rows
   *  underneath, not a hover change). The opacity fade is always 0.08s.
   */
  transition?: Transition | false
}

export function FluidHoverHighlight(props: FluidHoverHighlightProps) {
  const { from, xstyle, transition } = props
  const { rect, session } = resolveHighlightSource(props)
  // Reads the OS media query directly, so an installed copy honours reduced
  // motion without the app wrapping its tree in MotionConfig. A wrapped app
  // gets the same result twice over: the travel is a transform, which
  // MotionConfig reduces too.
  const reduceMotion = useReducedMotion() ?? false
  return (
    <AnimatePresence>
      {rect && (
        <motion.div
          key={session}
          data-slot="fluid-hover-highlight"
          // Pinned to the container's padding corner and moved with a
          // transform, so the travel runs on the compositor instead of
          // re-laying out every frame. Width and height are real layout
          // values, but they only change when the target rect's size does,
          // which in most lists is never.
          {...stylex.props(styles.highlight, xstyle)}
          initial={{ opacity: 0, ...toTarget(from ?? rect) }}
          animate={{ opacity: 1, ...toTarget(rect) }}
          exit={{ opacity: 0, transition: spring.fast.exit }}
          transition={resolveHighlightTransition(transition, reduceMotion)}
        />
      )}
    </AnimatePresence>
  )
}
