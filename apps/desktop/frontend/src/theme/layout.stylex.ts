import * as stylex from '@stylexjs/stylex'

/** Corner radii of the shape system (the rounded step; there is no pill mode). */
export const radius = stylex.defineConsts({
  /** Rows, buttons, inputs, selection backgrounds. */
  item: '8px',
  /** Popup shells: item radius plus the 4px inset, so the curves stay concentric. */
  container: '12px',
  /** The focus ring sits 2px outside its element. */
  focusRing: '10px',
  full: '9999px',
})

/** The two-step control ladder shared by every control. */
export const control = stylex.defineConsts({
  height: '36px',
  heightCompact: '28px',
})

/** Shared motion timings. */
export const motion = stylex.defineConsts({
  fast: '80ms',
  press: '180ms',
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
})
