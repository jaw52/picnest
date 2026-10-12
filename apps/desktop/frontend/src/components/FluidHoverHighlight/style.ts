import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'

export const styles = stylex.create({
  highlight: {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
    backgroundColor: colors['--ps-hover'],
    borderRadius: radius.item,
  },
})
