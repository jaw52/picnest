import { motion } from 'motion/react'

import { cn } from '~/lib/cn'
import { spring } from '~/lib/springs'

export interface ProgressRingProps {
  className?: string
  label: string
  max?: number
  /** Diameter in px. */
  size?: number
  value: number
}

const STROKE = 2

/**
 * A small determinate ring, filling clockwise from the top. Like
 * ProgressBar, the fill moves on a spring.
 */
export function ProgressRing({ label, value, max = 100, size = 16, className }: ProgressRingProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const r = (size - STROKE) / 2

  return (
    <svg
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={value}
      className={cn('shrink-0 -rotate-90', className)}
      height={size}
      role="progressbar"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
    >
      <circle className="fill-none stroke-fill-secondary" cx={size / 2} cy={size / 2} r={r} strokeWidth={STROKE} />
      <motion.circle
        animate={{ pathLength: ratio }}
        className="fill-none stroke-text"
        cx={size / 2}
        cy={size / 2}
        initial={false}
        r={r}
        strokeLinecap="round"
        strokeWidth={STROKE}
        transition={spring.moderate}
      />
    </svg>
  )
}
