import type { SizeVariant } from './context'
import { use, useMemo } from 'react'
import { sizeStyles } from '~/theme/size'
import { textStyle } from '~/theme/text'
import { SizeContext } from './context'

/** Resolve the active step: explicit override > surrounding provider > default. */
export function useSizeVariant(override?: SizeVariant | null): SizeVariant {
  const ctx = use(SizeContext)
  return override ?? ctx
}

export function useSize(override?: SizeVariant | null) {
  const variant = useSizeVariant(override)
  return useMemo(() => {
    const compact = variant === 'compact'
    return {
      variant,
      compact,
      /** Height of bounded controls and list rows, in px. */
      controlHeight: compact ? 28 : 36,
      /** Glyph size in px: icons inside controls. */
      icon: compact ? 14 : 16,
      control: compact ? sizeStyles.controlCompact : sizeStyles.control,
      segmentItem: compact ? sizeStyles.segmentItemCompact : sizeStyles.segmentItem,
      px: compact ? sizeStyles.pxCompact : sizeStyles.px,
      itemPx: compact ? sizeStyles.itemPxCompact : sizeStyles.itemPx,
      gap: compact ? sizeStyles.gapCompact : sizeStyles.gap,
      /** Body text inside controls. */
      text: textStyle('body', compact),
      /** One text style per type role at this step. */
      type: {
        display: textStyle('display', compact),
        title: textStyle('title', compact),
        subtitle: textStyle('subtitle', compact),
        body: textStyle('body', compact),
        caption: textStyle('caption', compact),
        micro: textStyle('micro', compact),
      },
    }
  }, [variant])
}
