import { defineConfig, presetIcons, presetWind4 } from 'unocss'

const TYPE_ROLES = ['display', 'title', 'subtitle', 'body', 'caption', 'micro'] as const
const SURFACES = [1, 2, 3, 4, 5, 6, 7, 8] as const

/** Every role at both steps of the size ladder, read from the `--ps-fs-*` / `--ps-lh-*` tokens. */
const text = Object.fromEntries(
  TYPE_ROLES.flatMap(role => ['', '-compact'].map(step => [
    `${role}${step}`,
    { fontSize: `var(--ps-fs-${role}${step})`, lineHeight: `var(--ps-lh-${role}${step})` },
  ])),
)

/** The variable font's weights (wght + opsz axes), for the normal → semibold shift that signals interaction. */
export const FONT_WEIGHTS = {
  normal: '\'wght\' 400, \'opsz\' 14',
  semibold: '\'wght\' 550, \'opsz\' 18',
  bold: '\'wght\' 700, \'opsz\' 25',
} as const

const color = (name: string) => `var(--ps-${name})`

export default defineConfig({
  // Class names also live in plain .ts files: menu items' icons, size steps.
  content: { pipeline: { include: [/\.(?:vue|ts)(?:$|\?)/] } },
  presets: [
    presetWind4(),
    presetIcons({
      collections: { mingcute: async () => import('@iconify-json/mingcute/icons.json').then(icons => icons.default) },
      extraProperties: { 'display': 'block', 'flex-shrink': '0' },
    }),
  ],
  theme: {
    font: { sans: color('font-sans') },
    colors: {
      'background': color('background'),
      'foreground': color('foreground'),
      'card': color('card'),
      'muted': color('muted'),
      'muted-foreground': color('muted-foreground'),
      'titlebar': color('titlebar'),
      'accent': color('accent'),
      'selected': color('selected'),
      'border': color('border'),
      'destructive': color('destructive'),
      'info': color('info'),
      'success': color('success'),
      'focus-ring': color('focus-ring'),
      'rating': color('rating'),
      'hover': color('hover'),
      'active': color('active'),
      'tint': color('tint'),
      'tint-hover': color('tint-hover'),
      'surface': Object.fromEntries(SURFACES.map(level => [level, color(`surface-${level}`)])),
    },
    text,
    radius: {
      'item': '8px',
      'container': '12px',
      'focus-ring': '10px',
    },
    ease: { out: 'cubic-bezier(0.23, 1, 0.32, 1)' },
  },
  rules: [
    // The shadow paired 1:1 with each rung of the surface ladder; `-inset` keeps light mode's hairline inside the box.
    [/^elevation-([1-8])(-inset)?$/, ([, level, inset]) => ({ 'box-shadow': color(`shadow-${level}${inset ?? ''}`) })],
    [/^wght-(normal|semibold|bold)$/, ([, weight]) => ({ 'font-variation-settings': FONT_WEIGHTS[weight as keyof typeof FONT_WEIGHTS] })],
    // Trims the line box to cap-height → baseline so labels center optically.
    // `text-box` only applies to block containers: put it on a blockified
    // element (a flex item, grid child), not a flex root.
    ['trim-cap', { 'text-box': 'trim-both cap alphabetic' }],
  ],
  shortcuts: {
    // Grid children stacked in one cell: a label over an invisible sizer.
    'stack-cell': 'col-start-1 row-start-1',
  },
})
