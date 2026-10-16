import * as stylex from '@stylexjs/stylex'
import { motion as motionTokens, radius } from './layout.stylex'

const hidden = ':is([data-starting-style], [data-ending-style])'

/**
 * The shell shared by modal dialogs: a dimming backdrop and a centred popup
 * that fades and settles in. Each dialog adds its own size and layout.
 */
export const dialog = stylex.create({
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    backgroundColor: 'rgb(0 0 0 / 0.4)',
    opacity: { default: 1, [hidden]: 0 },
    transitionProperty: 'opacity',
    transitionDuration: '150ms',
  },
  popup: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    borderRadius: radius.container,
    outline: 'none',
    opacity: { default: 1, [hidden]: 0 },
    transform: {
      default: 'translate(-50%, -50%)',
      [hidden]: 'translate(-50%, -50%) scale(0.97)',
    },
    transitionProperty: 'opacity, transform',
    transitionDuration: '150ms',
    transitionTimingFunction: motionTokens.easeOut,
  },
})
