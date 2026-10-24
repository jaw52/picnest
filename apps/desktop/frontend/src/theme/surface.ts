import * as stylex from '@stylexjs/stylex'
import { colors } from './colors.stylex'
import { shadows } from './shadows.stylex'

/** Background of each rung of the 8-step surface ladder (1 is the page). */
const surfaceBg = stylex.create({
  1: { backgroundColor: colors['--ps-surface-1'] },
  2: { backgroundColor: colors['--ps-surface-2'] },
  3: { backgroundColor: colors['--ps-surface-3'] },
  4: { backgroundColor: colors['--ps-surface-4'] },
  5: { backgroundColor: colors['--ps-surface-5'] },
  6: { backgroundColor: colors['--ps-surface-6'] },
  7: { backgroundColor: colors['--ps-surface-7'] },
  8: { backgroundColor: colors['--ps-surface-8'] },
})

/** Shadow recipe paired 1:1 with each surface rung. */
const surfaceShadow = stylex.create({
  1: { boxShadow: shadows['--ps-shadow-1'] },
  2: { boxShadow: shadows['--ps-shadow-2'] },
  3: { boxShadow: shadows['--ps-shadow-3'] },
  4: { boxShadow: shadows['--ps-shadow-4'] },
  5: { boxShadow: shadows['--ps-shadow-5'] },
  6: { boxShadow: shadows['--ps-shadow-6'] },
  7: { boxShadow: shadows['--ps-shadow-7'] },
  8: { boxShadow: shadows['--ps-shadow-8'] },
})

const clampLevel = (level: number) => Math.round(Math.max(1, Math.min(8, level)))

/**
 * Background + shadow styles for a surface level. Fractional levels round
 *  after clamping so they can't index out of the ladder.
 */
export function surfaceStyles(bgLevel: number, shadowLevel: number = bgLevel) {
  return [
    surfaceBg[clampLevel(bgLevel) as 1],
    surfaceShadow[clampLevel(shadowLevel) as 1],
  ] as const
}
