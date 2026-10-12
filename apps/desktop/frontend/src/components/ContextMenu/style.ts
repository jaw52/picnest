import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'

const hidden = ':is([data-starting-style], [data-ending-style])'

export const styles = stylex.create({
  // The trigger adds no box: children lay out as if unwrapped while their
  // right-clicks still bubble up to it.
  trigger: { display: 'contents' },
  positioner: { zIndex: 50 },
  // The popup is the rows' offsetParent, so the hover highlight measures from
  // its padding corner.
  popup: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    // Rows are as tall as their hover highlight: keep neighbours apart.
    gap: 2,
    boxSizing: 'border-box',
    width: 224,
    maxWidth: '100%',
    maxHeight: 'min(480px, var(--available-height))',
    padding: 4,
    overflowY: 'auto',
    borderRadius: radius.container,
    outline: 'none',
    userSelect: 'none',
    transformOrigin: 'var(--transform-origin)',
    opacity: { default: 1, [hidden]: 0 },
    transform: { default: 'none', [hidden]: 'scaleY(0.96)' },
    transitionProperty: 'opacity, transform',
    transitionDuration: '80ms',
    transitionTimingFunction: 'ease-out',
  },

  row: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    cursor: 'pointer',
    outline: 'none',
    borderRadius: radius.item,
  },
  rowDisabled: { opacity: 0.5, pointerEvents: 'none' },

  iconCell: { display: 'inline-grid' },
  iconSizer: { gridColumnStart: 1, gridRowStart: 1, visibility: 'hidden' },
  icon: {
    gridColumnStart: 1,
    gridRowStart: 1,
    transitionProperty: 'color, stroke-width',
    transitionDuration: '80ms',
  },
  lit: { color: colors['--ps-foreground'] },
  dim: { color: colors['--ps-muted-foreground'] },
  destructive: { color: colors['--ps-destructive'] },

  label: { display: 'inline-grid', flexGrow: 1 },
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
    transitionDuration: '80ms',
  },
})
