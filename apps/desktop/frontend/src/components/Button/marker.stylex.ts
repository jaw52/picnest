import * as stylex from '@stylexjs/stylex'

/**
 * Marks a button root so its inner layers react to its own hover and press,
 *  not to an unrelated hovered ancestor.
 */
export const buttonMarker = stylex.defineMarker()
