import type { MotionValue } from 'framer-motion'
import * as stylex from '@stylexjs/stylex'
import { motion, useTransform } from 'framer-motion'
import { PULL_MAX } from '~/hooks/useBottomPull'
import { colors } from '~/theme/colors.stylex'

const styles = stylex.create({
  arc: {
    position: 'fixed',
    insetInline: 0,
    bottom: 0,
    pointerEvents: 'none',
    // The page's gray a shade deeper, mostly opaque, so it stands out over
    // any photo while still hinting at what is under it.
    backgroundColor: `color-mix(in srgb, color-mix(in oklab, ${colors['--ps-foreground']} 14%, ${colors['--ps-background']}) 65%, transparent)`,
    backdropFilter: 'blur(8px)',
  },
})

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
  const clipPath = useTransform(pull, p => `path('${arcPath(p)} Z')`)
  const opacity = useTransform(pull, [0, PULL_MAX * 0.25], [0, 1])

  return (
    <motion.div
      aria-hidden
      className={stylex.props(styles.arc).className}
      style={{ height: PULL_MAX, clipPath, WebkitClipPath: clipPath, opacity }}
    />
  )
}
