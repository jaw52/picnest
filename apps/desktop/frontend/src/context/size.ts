import type { InjectionKey } from 'vue'
import { inject, provide } from 'vue'

export type SizeVariant = 'default' | 'compact'

type TypeRole = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'micro'

/** The classes for one step of the two-step size ladder every control shares. */
export interface Size {
  variant: SizeVariant
  compact: boolean
  /** Height of bounded controls and list rows, in px. */
  controlHeight: number
  /** Bounded control height; list/menu rows share it so a popup row lines up with its trigger. */
  control: string
  /** Tab trigger height inside a padded segmented list. */
  segmentItem: string
  /** Horizontal padding of bounded controls. */
  px: string
  /** Horizontal padding of list/menu rows, which sit inside a padded popup. */
  itemPx: string
  /** Gap between a glyph and its label, and between neighbouring controls. */
  gap: string
  /** Glyphs inside controls. */
  icon: string
  /** Body text inside controls. */
  text: string
  /** One text style per type role at this step. */
  type: Record<TypeRole, string>
}

const SIZES: Record<SizeVariant, Size> = {
  default: {
    variant: 'default',
    compact: false,
    controlHeight: 36,
    control: 'h-9',
    segmentItem: 'h-7',
    px: 'px-3',
    itemPx: 'px-2',
    gap: 'gap-2',
    icon: 'size-4',
    text: 'text-body',
    type: {
      display: 'text-display',
      title: 'text-title',
      subtitle: 'text-subtitle',
      body: 'text-body',
      caption: 'text-caption',
      micro: 'text-micro',
    },
  },
  compact: {
    variant: 'compact',
    compact: true,
    controlHeight: 28,
    control: 'h-7',
    segmentItem: 'h-6',
    px: 'px-2.5',
    itemPx: 'px-1.5',
    gap: 'gap-1',
    icon: 'size-3.5',
    text: 'text-body-compact',
    type: {
      display: 'text-display-compact',
      title: 'text-title-compact',
      subtitle: 'text-subtitle-compact',
      body: 'text-body-compact',
      caption: 'text-caption-compact',
      micro: 'text-micro-compact',
    },
  },
}

const sizeKey: InjectionKey<SizeVariant> = Symbol('size')

/** Pins everything inside to one step of the size ladder. */
export function provideSize(variant: SizeVariant): void {
  provide(sizeKey, variant)
}

/** The step of the surrounding region, or the default step outside any. */
export function useSizeVariant(): SizeVariant {
  return inject(sizeKey, 'default')
}

export function useSize(): Size {
  return SIZES[useSizeVariant()]
}
