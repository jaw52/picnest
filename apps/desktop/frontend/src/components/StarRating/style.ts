import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { motion } from '~/theme/layout.stylex'

export const styles = stylex.create({
  root: { display: 'inline-flex', alignItems: 'center', gap: 2 },
  button: {
    cursor: 'pointer',
    padding: 2,
    lineHeight: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 4,
    outline: { 'default': 'none', ':focus-visible': `2px solid ${colors['--ps-focus-ring']}` },
  },
  star: { transitionProperty: 'color', transitionDuration: motion.fast },
  filled: { color: colors['--ps-rating'] },
  empty: { color: colors['--ps-muted-foreground'] },
  // Drawn over a photo: empty stars stay light whatever the theme.
  emptyOnImage: { color: 'rgb(255 255 255 / 0.7)' },
})
