import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { motion, radius } from '~/theme/layout.stylex'
import { type } from '~/theme/typography.stylex'

const dark = '@media (prefers-color-scheme: dark)'

/**
 * The thumb's layout box. Travel is the track width minus this, so the thumb
 * never overhangs either end; the visible knob is the smaller circle inside it.
 */
export const THUMB_SIZE = 20
const KNOB_SIZE = 16
// 2px shorter than the thumb box, so the 16px knob fits inside the pill with
// 1px to spare above and below.
const TRACK_HEIGHT = 18
/** Inset so the pill's rounded-end centers align with thumb centers at min/max. */
export const TRACK_INSET = (THUMB_SIZE - TRACK_HEIGHT) / 2

export const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    userSelect: 'none',
    touchAction: 'none',
    overflow: 'visible',
    opacity: { 'default': 1, ':is([data-disabled])': 0.5 },
    pointerEvents: { 'default': null, ':is([data-disabled])': 'none' },
  },
  // Weight, not color, signals interaction: normal → semibold while hovered or
  // pressed. tabular-nums plus a ghost set at semibold (the heaviest this
  // label gets) keep the box from changing width.
  value: {
    display: 'inline-grid',
    flexShrink: 0,
    fontSize: type['--ps-fs-body'],
    lineHeight: 1,
    color: colors['--ps-muted-foreground'],
    fontVariantNumeric: 'tabular-nums',
    transitionProperty: 'font-variation-settings',
    transitionDuration: '100ms',
  },
  valueCell: { gridColumnStart: 1, gridRowStart: 1, whiteSpace: 'nowrap' },
  valueGhost: { visibility: 'hidden', fontVariationSettings: '\'wght\' 550, \'opsz\' 18' },
  control: {
    position: 'relative',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    // py-2 adds 8px above and below the 20px thumb row, so the press target is
    // 36px tall.
    height: THUMB_SIZE + 16,
    cursor: 'ew-resize',
  },
  // overflow hidden clips the fill and hover bar to the pill, so they inherit
  // its rounded ends.
  track: {
    position: 'absolute',
    left: TRACK_INSET,
    right: TRACK_INSET,
    top: 8 + TRACK_INSET,
    height: TRACK_HEIGHT,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors['--ps-border'],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: {
      default: `color-mix(in srgb, ${colors['--ps-selected']} 50%, transparent)`,
      [dark]: `color-mix(in srgb, ${colors['--ps-accent']} 40%, transparent)`,
    },
  },
  fillWidth: (width: string) => ({ width }),
  // The bar previews what a click would change: it runs from the thumb's
  // center to the snapped hover value, 40% accent, fading over 150ms.
  preview: {
    position: 'absolute',
    top: 0,
    height: '100%',
    pointerEvents: 'none',
    zIndex: 2,
    backgroundColor: `color-mix(in srgb, ${colors['--ps-accent']} 40%, transparent)`,
    transitionProperty: 'opacity',
    transitionDuration: '150ms',
  },
  previewVisible: { opacity: 1 },
  previewHidden: { opacity: 0 },
  previewPosition: (left: number, width: number, rightward: boolean) => ({
    left,
    width,
    borderRadius: rightward ? '0 9999px 9999px 0' : '9999px 0 0 9999px',
  }),
  // A 20px box centered on the track holding the 16px knob. The ring is
  // drawn around the box, 2px out (24px), for keyboard focus only.
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    outline: { 'default': 'none', ':has(:focus-visible)': `1px solid ${colors['--ps-focus-ring']}` },
    outlineOffset: 1,
    zIndex: 10,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: radius.full,
    backgroundColor: 'white',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    transitionProperty: 'width, height',
    transitionDuration: motion.fast,
  },
})
