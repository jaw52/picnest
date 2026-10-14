import * as stylex from '@stylexjs/stylex'

const dark = '@media (prefers-color-scheme: dark)'

/**
 * Every color token is written once as a light/dark pair; the OS appearance
 * picks the side (`color-scheme: light dark` is set on the root in theme.css).
 *
 * Surface ladder: light is two color steps (floor, sunken) then flat white,
 * with shadow doing the work; dark is an additive ladder over #171717. Each
 * surface pairs 1:1 with a rung of the shadow ladder (see shadows.stylex.ts).
 */
export const colors = stylex.defineVars({
  '--ps-surface-1': { default: '#fafafa', [dark]: '#171717' },
  '--ps-surface-2': { default: '#fcfcfc', [dark]: '#1e1e1e' },
  '--ps-surface-3': { default: '#ffffff', [dark]: '#252525' },
  '--ps-surface-4': { default: '#ffffff', [dark]: '#2c2c2c' },
  '--ps-surface-5': { default: '#ffffff', [dark]: '#333333' },
  '--ps-surface-6': { default: '#ffffff', [dark]: '#3a3a3a' },
  '--ps-surface-7': { default: '#ffffff', [dark]: '#414141' },
  '--ps-surface-8': { default: '#ffffff', [dark]: '#484848' },

  '--ps-background': { default: '#fafafa', [dark]: '#171717' },
  '--ps-foreground': { default: '#171717', [dark]: '#f5f5f5' },
  '--ps-card': { default: '#ffffff', [dark]: '#252525' },
  '--ps-card-foreground': { default: '#171717', [dark]: '#f5f5f5' },
  // Light `muted` decouples from surface2: the light ladder is so compressed
  // that anything sitting on it (the tab track) would blend into the page.
  '--ps-muted': { default: '#f4f4f5', [dark]: '#1e1e1e' },
  // The tab bar, a step below the page so the active tab, in the page's
  // color, reads as part of it.
  '--ps-titlebar': { default: '#ebebeb', [dark]: '#0e0e0e' },
  '--ps-muted-foreground': { default: '#737373', [dark]: '#a3a3a3' },

  '--ps-accent': { default: '#e5e5e5', [dark]: '#525252' },
  '--ps-accent-foreground': { default: '#171717', [dark]: '#f5f5f5' },
  '--ps-selected': { default: '#d4d4d4', [dark]: '#525252' },

  // foreground at 12% over transparent.
  '--ps-border': { default: 'rgb(23 23 23 / 0.12)', [dark]: 'rgb(245 245 245 / 0.12)' },
  '--ps-ring': { default: '#e5e5e5', [dark]: '#404040' },
  '--ps-input': { default: '#e5e5e5', [dark]: '#404040' },

  '--ps-destructive': { default: '#ef4444', [dark]: '#fca5a5' },
  '--ps-destructive-light': { default: '#fef2f2', [dark]: '#450a0a' },
  '--ps-info': { default: '#3b82f6', [dark]: '#93c5fd' },
  '--ps-success': { default: '#22c55e', [dark]: '#86efac' },
  '--ps-warning': { default: '#f59e0b', [dark]: '#fcd34d' },

  // The single theming point for every component's focus ring.
  '--ps-focus-ring': '#6b97ff',
  // Star ratings sit on photos as well as the page: one amber that reads on both.
  '--ps-rating': 'hsl(38 92% 50%)',

  // Surface-relative interactive overlays; they work on any elevation.
  '--ps-hover': { default: 'rgb(0 0 0 / 0.04)', [dark]: 'rgb(255 255 255 / 0.06)' },
  '--ps-active': { default: 'rgb(0 0 0 / 0.07)', [dark]: 'rgb(255 255 255 / 0.1)' },
  // See-through fill for secondary buttons: on a panel it takes on the color
  // underneath. Hover is lighter, like the solid hover it replaced.
  '--ps-tint': { default: 'rgb(0 0 0 / 0.08)', [dark]: 'rgb(255 255 255 / 0.25)' },
  '--ps-tint-hover': { default: 'rgb(0 0 0 / 0.065)', [dark]: 'rgb(255 255 255 / 0.2)' },

  // Scrollbar thumb ramp (rest, hover, drag): the overlay tint at 8/12/16%.
  '--ps-scroll-thumb': { default: 'rgb(0 0 0 / 0.08)', [dark]: 'rgb(255 255 255 / 0.08)' },
  '--ps-scroll-thumb-hover': { default: 'rgb(0 0 0 / 0.12)', [dark]: 'rgb(255 255 255 / 0.12)' },
  '--ps-scroll-thumb-active': { default: 'rgb(0 0 0 / 0.16)', [dark]: 'rgb(255 255 255 / 0.16)' },
})
