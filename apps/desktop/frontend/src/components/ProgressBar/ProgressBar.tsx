import { motion } from 'motion/react'

import { cn } from '~/lib/cn'
import { spring } from '~/lib/springs'

export interface ProgressBarProps {
  className?: string
  label: string
  max?: number
  tone?: 'default' | 'error'
  value: number
}

/**
 * A thin determinate bar. The fill scales on a spring rather than animating
 * its width, so it stays on the compositor.
 */
export function ProgressBar({ label, value, max = 100, tone = 'default', className }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={value}
      className={cn('h-1 overflow-hidden rounded-full bg-fill-secondary', className)}
      role="progressbar"
    >
      <motion.div
        animate={{ scaleX: ratio }}
        className={cn('h-full origin-left', tone === 'error' ? 'bg-red' : 'bg-text')}
        initial={false}
        transition={spring.moderate}
      />
    </div>
  )
}
