import type { StyleXStyles } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { motion } from 'framer-motion'
import { spring } from '~/lib/springs'
import { styles } from './style'

export interface ProgressRingProps {
  label: string
  value: number
  max?: number
  /** Diameter in px. */
  size?: number
  xstyle?: StyleXStyles
}

const STROKE = 2

/**
 * A small determinate ring, filling clockwise from the top. Like
 * ProgressBar, the fill moves on a spring.
 */
export function ProgressRing({ label, value, max = 100, size = 16, xstyle }: ProgressRingProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const r = (size - STROKE) / 2

  return (
    <svg
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      {...stylex.props(styles.ring, xstyle)}
    >
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={STROKE} {...stylex.props(styles.track)} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={STROKE}
        strokeLinecap="round"
        {...stylex.props(styles.fill)}
        initial={false}
        animate={{ pathLength: ratio }}
        transition={spring.moderate}
      />
    </svg>
  )
}
