import type { Transition } from 'motion/react'

import type { ItemRect } from '~/hooks/use-fluid-hover'
import { spring } from '~/lib/springs'

import type { FluidHoverHighlightProps } from './FluidHoverHighlight'

const fade: Transition = { duration: 0.08 }
const snap: Transition = { duration: 0 }

/**
 * A measured rect as animation targets: position as a transform, size as
 *  layout. Exported for the unit test.
 */
export function toTarget(rect: ItemRect) {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/**
 * Resolves the positional transition. Reduced motion keeps the opacity fade
 * and drops the travel, per the motion guidelines: fewer and gentler, not
 * none. Exported for the unit test.
 */
export function resolveHighlightTransition(
  transition: Transition | false | undefined,
  reduceMotion: boolean,
): Transition {
  const positional = transition === false || reduceMotion ? snap : (transition ?? spring.fast)
  return { ...positional, opacity: fade }
}

/** The rect and session a set of props resolves to. Exported for the test. */
export function resolveHighlightSource(props: FluidHoverHighlightProps): { rect: ItemRect | null; session: number } {
  if (props.hover) {
    const { activeIndex, itemRects, isMeasured, session } = props.hover
    const rect = !props.hidden && isMeasured && activeIndex !== null ? (itemRects[activeIndex] ?? null) : null
    return { rect, session }
  }
  return { rect: props.rect, session: props.session }
}
