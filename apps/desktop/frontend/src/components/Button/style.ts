import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'
import { control, motion, radius } from '~/theme/layout.stylex'
import { type } from '~/theme/typography.stylex'
import { buttonMarker } from './marker.stylex'

const spinnerMove = stylex.keyframes({
  to: { strokeDashoffset: -100 },
})

const spinnerDash = stylex.keyframes({
  '0%': { strokeDasharray: '15 85' },
  '50%': { strokeDasharray: '40 60' },
  '100%': { strokeDasharray: '15 85' },
})

export const styles = stylex.create({
  root: {
    position: 'relative',
    isolation: 'isolate',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.item,
    outline: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    transitionProperty: 'color',
    transitionDuration: motion.fast,
    opacity: { 'default': 1, ':disabled': 0.5 },
    pointerEvents: { 'default': null, ':disabled': 'none' },
    boxShadow: { 'default': null, ':focus-visible': `0 0 0 1px ${colors['--ps-focus-ring']}` },
  },

  // Text color per variant.
  primary: { color: colors['--ps-background'] },
  destructive: { color: colors['--ps-background'] },
  secondary: { color: colors['--ps-foreground'] },
  tertiary: { color: colors['--ps-foreground'] },
  ghost: {
    color: {
      default: colors['--ps-muted-foreground'],
      [stylex.when.ancestor(':hover', buttonMarker)]: colors['--ps-foreground'],
    },
  },

  // The two-step size ladder shared by every control (see theme/size.ts).
  sizeDefault: {
    height: control.height,
    paddingInline: 16,
    gap: 6,
    fontSize: type['--ps-fs-body'],
    lineHeight: type['--ps-lh-body'],
  },
  sizeCompact: {
    height: control.heightCompact,
    paddingInline: 12,
    gap: 4,
    fontSize: type['--ps-fs-body-compact'],
    lineHeight: type['--ps-lh-body-compact'],
  },
  sizeIcon: { height: control.height, width: control.height, padding: 0 },
  sizeIconCompact: { height: control.heightCompact, width: control.heightCompact, padding: 0 },
  // An icon sits 4px closer to its edge than text does.
  iconLeftDefault: { paddingLeft: 12 },
  iconLeftCompact: { paddingLeft: 8 },
  iconRightDefault: { paddingRight: 12 },
  iconRightCompact: { paddingRight: 8 },

  // Press effect: the surface sits 1px inside the button and a same-color
  // shadow spread fills it back out. Pressing collapses the spread, shrinking
  // the surface by exactly 1px per side at any width, which a scale could not.
  // Secondary's fills are see-through, so it takes on the surface under it.
  surface: {
    position: 'absolute',
    inset: 1,
    borderRadius: 'inherit',
    transitionProperty: 'box-shadow, background-color',
    transitionDuration: { default: '180ms, 80ms', [stylex.when.ancestor(':active', buttonMarker)]: '80ms, 80ms' },
    transitionTimingFunction: `${motion.easeOut}, ease`,
  },
  surfacePrimary: {
    backgroundColor: {
      default: colors['--ps-foreground'],
      [stylex.when.ancestor(':hover', buttonMarker)]: `color-mix(in oklab, ${colors['--ps-foreground']} 90%, ${colors['--ps-background']})`,
      [stylex.when.ancestor(':active', buttonMarker)]: `color-mix(in oklab, ${colors['--ps-foreground']} 80%, ${colors['--ps-background']})`,
    },
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-foreground']}`,
      [stylex.when.ancestor(':hover', buttonMarker)]: `0 0 0 1px color-mix(in oklab, ${colors['--ps-foreground']} 90%, ${colors['--ps-background']})`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px color-mix(in oklab, ${colors['--ps-foreground']} 80%, ${colors['--ps-background']})`,
    },
  },
  // Primary's recipe in the destructive color, for actions that remove files.
  surfaceDestructive: {
    backgroundColor: {
      default: colors['--ps-destructive'],
      [stylex.when.ancestor(':hover', buttonMarker)]: `color-mix(in oklab, ${colors['--ps-destructive']} 90%, ${colors['--ps-background']})`,
      [stylex.when.ancestor(':active', buttonMarker)]: `color-mix(in oklab, ${colors['--ps-destructive']} 80%, ${colors['--ps-background']})`,
    },
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-destructive']}`,
      [stylex.when.ancestor(':hover', buttonMarker)]: `0 0 0 1px color-mix(in oklab, ${colors['--ps-destructive']} 90%, ${colors['--ps-background']})`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px color-mix(in oklab, ${colors['--ps-destructive']} 80%, ${colors['--ps-background']})`,
    },
  },
  surfaceSecondary: {
    backgroundColor: {
      default: colors['--ps-tint'],
      [stylex.when.ancestor(':hover', buttonMarker)]: colors['--ps-tint-hover'],
      [stylex.when.ancestor(':active', buttonMarker)]: colors['--ps-tint'],
    },
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-tint']}`,
      [stylex.when.ancestor(':hover', buttonMarker)]: `0 0 0 1px ${colors['--ps-tint-hover']}`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px ${colors['--ps-tint']}`,
    },
  },
  // The border ring is an outer 1px shadow at rest that hands off to an inset
  // 1px shadow when pressed, so the ring moves inward with the surface. The
  // translucent fill only ever reaches the ring's inner edge, so it needs no
  // spread of its own.
  surfaceTertiary: {
    backgroundColor: {
      default: 'transparent',
      [stylex.when.ancestor(':hover', buttonMarker)]: colors['--ps-hover'],
      [stylex.when.ancestor(':active', buttonMarker)]: colors['--ps-active'],
    },
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-border']}, inset 0 0 0 0px ${colors['--ps-border']}`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px ${colors['--ps-border']}, inset 0 0 0 1px ${colors['--ps-border']}`,
    },
  },
  // Translucent fill + same-color spread never double up: outer shadows render
  // only outside the surface box.
  surfaceGhost: {
    backgroundColor: {
      default: 'transparent',
      [stylex.when.ancestor(':hover', buttonMarker)]: colors['--ps-hover'],
      [stylex.when.ancestor(':active', buttonMarker)]: colors['--ps-active'],
    },
    boxShadow: {
      default: '0 0 0 1px transparent',
      [stylex.when.ancestor(':hover', buttonMarker)]: `0 0 0 1px ${colors['--ps-hover']}`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px ${colors['--ps-active']}`,
    },
  },

  // Forced-active (`active` prop): pressed colors at full size; the geometric
  // press-collapse still reacts on top.
  forcedPrimary: {
    backgroundColor: `color-mix(in oklab, ${colors['--ps-foreground']} 80%, ${colors['--ps-background']})`,
    boxShadow: {
      default: `0 0 0 1px color-mix(in oklab, ${colors['--ps-foreground']} 80%, ${colors['--ps-background']})`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px color-mix(in oklab, ${colors['--ps-foreground']} 80%, ${colors['--ps-background']})`,
    },
  },
  forcedDestructive: {
    backgroundColor: `color-mix(in oklab, ${colors['--ps-destructive']} 80%, ${colors['--ps-background']})`,
    boxShadow: {
      default: `0 0 0 1px color-mix(in oklab, ${colors['--ps-destructive']} 80%, ${colors['--ps-background']})`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px color-mix(in oklab, ${colors['--ps-destructive']} 80%, ${colors['--ps-background']})`,
    },
  },
  forcedSecondary: {
    backgroundColor: colors['--ps-tint'],
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-tint']}`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px ${colors['--ps-tint']}`,
    },
  },
  forcedTertiary: {
    backgroundColor: colors['--ps-active'],
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-border']}, inset 0 0 0 0px ${colors['--ps-border']}`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px ${colors['--ps-border']}, inset 0 0 0 1px ${colors['--ps-border']}`,
    },
  },
  forcedGhost: {
    backgroundColor: colors['--ps-active'],
    boxShadow: {
      default: `0 0 0 1px ${colors['--ps-active']}`,
      [stylex.when.ancestor(':active', buttonMarker)]: `0 0 0 0px ${colors['--ps-active']}`,
    },
  },

  content: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'inherit',
  },
  hiddenWhileLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'inherit',
    opacity: 0,
  },
  spinnerWrap: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerDefault: { width: control.height, height: control.height },
  spinnerCompact: { width: control.heightCompact, height: control.heightCompact },
  spinnerPath: {
    strokeDasharray: '15 85',
    animationName: `${spinnerMove}, ${spinnerDash}`,
    animationDuration: '2s, 4s',
    animationTimingFunction: 'linear, ease-in-out',
    animationIterationCount: 'infinite',
  },
})
