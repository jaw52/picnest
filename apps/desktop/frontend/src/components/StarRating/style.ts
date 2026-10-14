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
    transitionProperty: 'color',
    transitionDuration: motion.fast,
  },
  // Set on the buttons: an icon's own inline color is currentColor.
  filled: { color: colors['--ps-rating'] },
  // Outlined in the rating's own color, on the page or over a photo alike;
  // the "no rating" button too, solid under the pointer.
  empty: { color: `color-mix(in srgb, ${colors['--ps-rating']} 70%, transparent)` },
})
