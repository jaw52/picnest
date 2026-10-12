import * as stylex from '@stylexjs/stylex'
import { control } from './layout.stylex'

/**
 * The two-step size ladder shared by every control: default is a 36px control
 * height, compact is 28px for dense surfaces. Each property has a default and a
 * `Compact` entry; `useSize()` hands back the pair for the active step.
 */
export const sizeStyles = stylex.create({
  /**
   * Bounded control height; list/menu rows share it so a popup row lines up
   *  with the trigger that opened it.
   */
  control: { height: control.height },
  controlCompact: { height: control.heightCompact },
  /** Tab trigger height inside a padded segmented list. */
  segmentItem: { height: 28 },
  segmentItemCompact: { height: 24 },
  /** Horizontal padding of bounded controls. */
  px: { paddingInline: 12 },
  pxCompact: { paddingInline: 10 },
  /** Horizontal padding of list/menu rows, which sit inside a padded popup. */
  itemPx: { paddingInline: 8 },
  itemPxCompact: { paddingInline: 6 },
  /** Gap between a glyph and its label, and between neighbouring controls. */
  gap: { gap: 8 },
  gapCompact: { gap: 4 },
})
