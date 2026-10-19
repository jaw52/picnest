import * as stylex from '@stylexjs/stylex'
import { type } from './typography.stylex'

/**
 * One style per type role at each step of the ladder (size + leading), read
 * from the `--ps-fs-*` / `--ps-lh-*` tokens.
 */
export const text = stylex.create({
  display: { fontSize: type['--ps-fs-display'], lineHeight: type['--ps-lh-display'] },
  displayCompact: {
    fontSize: type['--ps-fs-display-compact'],
    lineHeight: type['--ps-lh-display-compact'],
  },
  title: { fontSize: type['--ps-fs-title'], lineHeight: type['--ps-lh-title'] },
  titleCompact: {
    fontSize: type['--ps-fs-title-compact'],
    lineHeight: type['--ps-lh-title-compact'],
  },
  subtitle: { fontSize: type['--ps-fs-subtitle'], lineHeight: type['--ps-lh-subtitle'] },
  subtitleCompact: {
    fontSize: type['--ps-fs-subtitle-compact'],
    lineHeight: type['--ps-lh-subtitle-compact'],
  },
  body: { fontSize: type['--ps-fs-body'], lineHeight: type['--ps-lh-body'] },
  bodyCompact: {
    fontSize: type['--ps-fs-body-compact'],
    lineHeight: type['--ps-lh-body-compact'],
  },
  caption: { fontSize: type['--ps-fs-caption'], lineHeight: type['--ps-lh-caption'] },
  captionCompact: {
    fontSize: type['--ps-fs-caption-compact'],
    lineHeight: type['--ps-lh-caption-compact'],
  },
  micro: { fontSize: type['--ps-fs-micro'], lineHeight: type['--ps-lh-micro'] },
  microCompact: {
    fontSize: type['--ps-fs-micro-compact'],
    lineHeight: type['--ps-lh-micro-compact'],
  },
})

export type TextRole = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'micro'

/** The style for one role at one step of the size ladder. */
export function textStyle(role: TextRole, compact = false) {
  const key: TextRole | `${TextRole}Compact` = compact ? `${role}Compact` : role
  return text[key]
}

/**
 * Variable-font weights (wght + opsz axes), used for the normal → semibold
 *  shift that signals interaction.
 */
export const weight = stylex.create({
  normal: { fontVariationSettings: '\'wght\' 400, \'opsz\' 14' },
  semibold: { fontVariationSettings: '\'wght\' 550, \'opsz\' 18' },
  bold: { fontVariationSettings: '\'wght\' 700, \'opsz\' 25' },
})

/**
 * The weight values as strings, for inline `style` where the weight is
 *  animated or chosen at runtime.
 */
export const fontWeights = {
  normal: '\'wght\' 400, \'opsz\' 14',
  semibold: '\'wght\' 550, \'opsz\' 18',
  bold: '\'wght\' 700, \'opsz\' 25',
} as const

export const trim = stylex.create({
  /**
   * Trims the line box to cap-height → baseline so labels center optically.
   *  `text-box` only applies to block containers, so put it on a blockified
   *  element (a flex item, grid child), not a flex root.
   */
  // eslint-disable-next-line @stylexjs/valid-styles -- the plugin predates text-box
  capAlphabetic: { textBox: 'trim-both cap alphabetic' },
})

export const utility = stylex.create({
  /** Sizes the box to the text only; hides the rest from layout and a11y reads. */
  invisible: { visibility: 'hidden' },
  stackCell: { gridColumnStart: 1, gridRowStart: 1 },
  inlineGrid: { display: 'inline-grid' },
  truncate: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  absoluteFill: { position: 'absolute', inset: 0 },
})
