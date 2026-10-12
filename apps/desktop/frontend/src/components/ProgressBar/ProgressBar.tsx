import type { StyleXStyles } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { motion } from 'framer-motion'
import { spring } from '~/lib/springs'
import { styles } from './style'

export interface ProgressBarProps {
  label: string
  value: number
  max?: number
  tone?: 'default' | 'error'
  xstyle?: StyleXStyles
}

/**
 * A thin determinate bar. The fill scales on a spring rather than animating
 * its width, so it stays on the compositor.
 */
export function ProgressBar({
  label,
  value,
  max = 100,
  tone = 'default',
  xstyle,
}: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      {...stylex.props(styles.track, xstyle)}
    >
      <motion.div
        {...stylex.props(styles.fill, tone === 'error' ? styles.toneError : styles.toneDefault)}
        initial={false}
        animate={{ scaleX: ratio }}
        transition={spring.moderate}
      />
    </div>
  )
}
