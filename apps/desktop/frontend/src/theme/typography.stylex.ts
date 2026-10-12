import * as stylex from '@stylexjs/stylex'

/**
 * Type scale: six roles, each a size and a leading at the default and compact
 * steps. Components read the `*Compact` pair or the default pair depending on
 * the surrounding SizeProvider.
 */
export const type = stylex.defineVars({
  '--ps-font-sans': `'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', system-ui, sans-serif`,

  '--ps-fs-display': '28px',
  '--ps-lh-display': '34px',
  '--ps-fs-display-compact': '24px',
  '--ps-lh-display-compact': '30px',
  '--ps-fs-title': '16px',
  '--ps-lh-title': '22px',
  '--ps-fs-title-compact': '15px',
  '--ps-lh-title-compact': '20px',
  '--ps-fs-subtitle': '14px',
  '--ps-lh-subtitle': '20px',
  '--ps-fs-subtitle-compact': '13px',
  '--ps-lh-subtitle-compact': '18px',
  '--ps-fs-body': '13px',
  '--ps-lh-body': '20px',
  '--ps-fs-body-compact': '12px',
  '--ps-lh-body-compact': '18px',
  '--ps-fs-caption': '12px',
  '--ps-lh-caption': '16px',
  '--ps-fs-caption-compact': '11px',
  '--ps-lh-caption-compact': '14px',
  '--ps-fs-micro': '11px',
  '--ps-lh-micro': '14px',
  '--ps-fs-micro-compact': '10px',
  '--ps-lh-micro-compact': '12px',
})
