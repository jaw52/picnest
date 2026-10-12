import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'

export const styles = stylex.create({
  track: {
    height: 4,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors['--ps-active'],
  },
  fill: { height: '100%', transformOrigin: 'left' },
  toneDefault: { backgroundColor: colors['--ps-foreground'] },
  toneError: { backgroundColor: colors['--ps-destructive'] },
})
