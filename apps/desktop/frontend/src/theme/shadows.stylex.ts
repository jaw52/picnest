import * as stylex from '@stylexjs/stylex'

const dark = '@media (prefers-color-scheme: dark)'

/**
 * Shadow ladder, one rung per surface level. Light draws a hairline plus
 * stacked drops; dark draws an inset highlight, an inset ring and stacked drops.
 * `--ps-shadow-2-inset` / `--ps-shadow-3-inset` keep the light hairline inside the box (the
 * dark recipes already draw their ring inset).
 */
export const shadows = stylex.defineVars({
  '--ps-shadow-1': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 0 0 1px rgba(255, 255, 255, 0.02)',
  },
  '--ps-shadow-2': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.01), inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-3': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.02), inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 0 0 1px rgba(0, 0, 0, 0.12), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-4': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06), 0 6px 6px -3px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.02), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.14), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-5': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06), 0 6px 6px -3px rgb(0 0 0 / 0.06), 0 12px 12px -6px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.16), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-6': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06), 0 6px 6px -3px rgb(0 0 0 / 0.06), 0 12px 12px -6px rgb(0 0 0 / 0.06), 0 24px 24px -12px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.18), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18), 0 24px 24px -12px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-7': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06), 0 6px 6px -3px rgb(0 0 0 / 0.06), 0 12px 12px -6px rgb(0 0 0 / 0.06), 0 24px 24px -12px rgb(0 0 0 / 0.06), 0 48px 48px -24px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.2), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18), 0 24px 24px -12px rgba(0, 0, 0, 0.18), 0 48px 48px -24px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-8': {
    default: '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06), 0 6px 6px -3px rgb(0 0 0 / 0.06), 0 12px 12px -6px rgb(0 0 0 / 0.06), 0 24px 24px -12px rgb(0 0 0 / 0.06), 0 48px 48px -24px rgb(0 0 0 / 0.06), 0 96px 96px -48px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.22), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18), 0 24px 24px -12px rgba(0, 0, 0, 0.18), 0 48px 48px -24px rgba(0, 0, 0, 0.18), 0 96px 96px -48px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-2-inset': {
    default: 'inset 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.01), inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18)',
  },
  '--ps-shadow-3-inset': {
    default: 'inset 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 1px -0.5px rgb(0 0 0 / 0.06), 0 3px 3px -1.5px rgb(0 0 0 / 0.06)',
    [dark]: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.02), inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 0 0 1px rgba(0, 0, 0, 0.12), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18)',
  },
})
