import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { type } from '~/theme/typography.stylex'

const hidden = ':is([data-starting-style], [data-ending-style])'
const top = ':is([data-side="top"][data-starting-style], [data-side="top"][data-ending-style])'
const bottom
  = ':is([data-side="bottom"][data-starting-style], [data-side="bottom"][data-ending-style])'
const left = ':is([data-side="left"][data-starting-style], [data-side="left"][data-ending-style])'
const right
  = ':is([data-side="right"][data-starting-style], [data-side="right"][data-ending-style])'

export const styles = stylex.create({
  positioner: { zIndex: 50 },
  popup: {
    backgroundColor: colors['--ps-foreground'],
    color: colors['--ps-background'],
    fontSize: type['--ps-fs-caption'],
    lineHeight: type['--ps-lh-caption'],
    fontVariationSettings: '\'wght\' 400, \'opsz\' 14',
    paddingBlock: 4,
    paddingInline: 8,
    borderRadius: radius.item,
    opacity: { default: 1, [hidden]: 0 },
    transform: {
      default: 'none',
      [top]: 'translateY(4px)',
      [bottom]: 'translateY(-4px)',
      [left]: 'translateX(4px)',
      [right]: 'translateX(-4px)',
    },
    transitionProperty: 'opacity, transform',
    transitionDuration: '80ms',
    transitionTimingFunction: 'ease-out',
  },
})
