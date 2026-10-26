import type { MotionValue } from 'motion/react'
import { motion, useTransform } from 'motion/react'

import { PULL_MAX } from '~/hooks/useBottomPull'

/**
 * The arc from one bottom corner to the other, bulging up by `pull` px:
 * a quadratic curve peaks halfway to its control point.
 */
function arcPath(pull: number) {
  const width = window.innerWidth
  return `M 0 ${PULL_MAX} Q ${width / 2} ${PULL_MAX - pull * 2} ${width} ${PULL_MAX}`
}

/**
 * What scrolling on past the end of the grid shows: an arc rising from the
 * bottom edge, bending further the harder it is pushed - after Android's
 * edge glow.
 */
export function OverscrollArc({ pull }: { pull: MotionValue<number> }) {
  const clipPath = useTransform(pull, (p) => `path('${arcPath(p)} Z')`)
  const opacity = useTransform(pull, [0, PULL_MAX * 0.25], [0, 1])

  return (
    <motion.div
      aria-hidden
      // The page's gray a shade deeper, mostly opaque, so it stands out over any
      // photo while still hinting at what is under it.
      className="pointer-events-none fixed inset-x-0 bottom-0 bg-[color-mix(in_srgb,color-mix(in_oklab,var(--color-text)_14%,var(--color-background))_65%,transparent)] backdrop-blur-sm"
      style={{ height: PULL_MAX, clipPath, WebkitClipPath: clipPath, opacity }}
    />
  )
}
