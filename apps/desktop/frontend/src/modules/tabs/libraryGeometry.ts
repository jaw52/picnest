/** The icon's coordinate space, the same as a folder's so they line up. */
export const W = 104
export const H = 84

/** Each photo: a white-bordered print, landscape, standing on the icon's bottom. */
export const PRINT = { width: 62, height: 48, border: 2.5, radius: 4 }
export const PRINT_X = (W - PRINT.width) / 2
export const PRINT_Y = H - PRINT.height - 8

/**
 * The prints from back to front: how far each turns and shifts sideways,
 * closed and fanned out on hover. They turn about their bottom edge, like
 * cards held in a hand.
 */
export const FAN = [
  { name: 'left', rotate: [-11, -19], x: [-7, -14], y: [1, 2] },
  { name: 'right', rotate: [9, 17], x: [7, 14], y: [0, 1] },
  { name: 'front', rotate: [0, 0], x: [0, 0], y: [0, -4] },
] as const

/**
 * What a print shows before there are photos to show: a landscape, each in
 * its own light, painted in the print's coordinates.
 */
export const PLACEHOLDERS = [
  { sky: ['#f9cb9c', '#e69138'], hill: '#b45f06' },
  { sky: ['#b6d7a8', '#6aa84f'], hill: '#38761d' },
  { sky: ['#9fc5e8', '#3d85c6'], hill: '#0b5394' },
] as const
