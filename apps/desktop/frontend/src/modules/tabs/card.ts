import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { cardMarker } from './markers.stylex'

/** The cell every card on the new-tab page sits in: an icon over its name. */
export const card = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: colors['--ps-foreground'],
  },
  // Like Finder, hovering highlights the icon, not the whole cell.
  iconWell: {
    padding: 8,
    borderRadius: radius.item,
    backgroundColor: {
      default: 'transparent',
      [stylex.when.ancestor(':hover', cardMarker)]: colors['--ps-hover'],
    },
    transitionProperty: 'background-color',
    transitionDuration: '80ms',
  },
})
