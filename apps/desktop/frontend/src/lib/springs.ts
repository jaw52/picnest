export const spring = {
  fast: {
    type: 'spring' as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  // Critically damped: same perceived speed as a bouncier tier, but it lands
  // exactly, with no overshoot. For short travel, and for panels and sheets
  // that must settle precisely (dropdowns, tabs, drawers, selection backgrounds).
  moderate: {
    type: 'spring' as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  slow: {
    type: 'spring' as const,
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
} as const
