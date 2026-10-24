import type { StyleXStyles } from '@stylexjs/stylex'
import type { ReactElement, ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import * as stylex from '@stylexjs/stylex'
import { trim } from '~/theme/text'
import { styles } from './style'

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
export function TooltipProvider({
  children,
  delay = DEFAULT_DELAY,
  timeout = 300,
}: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} timeout={timeout}>
      {children}
    </BaseTooltip.Provider>
  )
}

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  content: ReactNode
  /** The trigger: a single element that accepts a ref and event props. */
  children: ReactElement
  side?: TooltipSide
  sideOffset?: number
  /**
   * Hover delay before this tooltip opens, in ms. Defaults to the ambient
   *  TooltipProvider's delay.
   */
  delay?: number
  xstyle?: StyleXStyles
}

export function Tooltip({
  content,
  children,
  side = 'top',
  sideOffset = 8,
  delay,
  xstyle,
}: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={delay} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          side={side}
          sideOffset={sideOffset}
          {...stylex.props(styles.positioner)}
        >
          <BaseTooltip.Popup {...stylex.props(styles.popup, trim.capAlphabetic, xstyle)}>
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
