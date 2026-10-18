import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'

export const styles = stylex.create({
  // Turned so the fill starts at the top.
  ring: { flexShrink: 0, transform: 'rotate(-90deg)' },
  track: { fill: 'none', stroke: colors['--ps-active'] },
  fill: { fill: 'none', stroke: colors['--ps-foreground'] },
})
