import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { motion, radius } from '~/theme/layout.stylex'

export const styles = stylex.create({
  // Root is merged away: the list is the only box the layout sees.
  root: { display: 'contents' },
  // The negative margins and matching padding give the 2px-outset focus ring
  // room inside overflow-x. The max-width allows for the margins, so the first
  // and last tab's ring is not clipped.
  list: {
    'position': 'relative',
    'display': 'flex',
    'alignItems': 'center',
    'userSelect': 'none',
    'overflowX': 'auto',
    'maxWidth': 'calc(100% + 8px)',
    'minWidth': 0,
    'marginInline': -4,
    'marginBlock': -4,
    'paddingInline': 4,
    'paddingBlock': 4,
    'scrollbarWidth': 'none',
    '::-webkit-scrollbar': { display: 'none' },
  },
  pill: {
    position: 'absolute',
    pointerEvents: 'none',
    backgroundColor: colors['--ps-active'],
    borderRadius: radius.item,
  },
  focusRing: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors['--ps-focus-ring'],
    borderRadius: radius.focusRing,
  },
  tab: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderWidth: 0,
    outline: 'none',
    borderRadius: radius.item,
  },
  label: { display: 'inline-grid', whiteSpace: 'nowrap' },
  // Both stacked spans carry the text-box trim so the invisible bold sizer and
  // the visible label keep identical boxes.
  labelSizer: {
    gridColumnStart: 1,
    gridRowStart: 1,
    visibility: 'hidden',
  },
  labelText: {
    gridColumnStart: 1,
    gridRowStart: 1,
    transitionProperty: 'color, font-variation-settings',
    transitionDuration: motion.fast,
  },
  active: { color: colors['--ps-foreground'] },
  inactive: { color: colors['--ps-muted-foreground'] },
})
