import type { Transition } from 'framer-motion'

/** Collapse/expand tween for side panels: quick start, soft landing, no overshoot. */
const PANEL_TRANSITION: Transition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] }
const INSTANT: Transition = { duration: 0 }

/** The panel tween, or an instant one when the OS asks for reduced motion. */
export function panelTransition(): Transition {
  const reduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduced ? INSTANT : PANEL_TRANSITION
}
