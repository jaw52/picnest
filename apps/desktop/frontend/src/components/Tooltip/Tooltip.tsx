import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '~/lib/cn'

const DEFAULT_DELAY = 200

export interface TooltipProviderProps {
  children: ReactNode
  /** Hover delay before tooltips open, in ms. */
  delay?: number
  /**
   * After a tooltip closes, adjacent tooltips opened within this window skip
   *  the hover delay, in ms.
   */
  timeout?: number
}

/**
 * Groups descendant Tooltips so that once one opens, moving to an adjacent
 *  trigger shows its tooltip instantly instead of re-waiting the full delay.
 *  Wrap once at the app level.
 */
export function TooltipProvider({ children, delay = DEFAULT_DELAY, timeout = 300 }: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} timeout={timeout}>
      {children}
    </BaseTooltip.Provider>
  )
}

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  /** The trigger: a single element that accepts a ref and event props. */
  children: ReactElement
  className?: string
  content: ReactNode
  /**
   * Hover delay before this tooltip opens, in ms. Defaults to the ambient
   *  TooltipProvider's delay.
   */
  delay?: number
  side?: TooltipSide
  sideOffset?: number
}

export function Tooltip({ content, children, side = 'top', sideOffset = 8, delay, className }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={delay} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner className="z-50" side={side} sideOffset={sideOffset}>
          <BaseTooltip.Popup
            className={cn(
              'wght-normal text-trim rounded-item bg-text px-2 py-1 text-caption text-background',
              'transition-[opacity,transform] duration-80 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0',
              'data-[side=top]:data-ending-style:translate-y-1 data-[side=top]:data-starting-style:translate-y-1',
              'data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1',
              'data-[side=left]:data-ending-style:translate-x-1 data-[side=left]:data-starting-style:translate-x-1',
              'data-[side=right]:data-ending-style:-translate-x-1 data-[side=right]:data-starting-style:-translate-x-1',
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
