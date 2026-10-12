import type { StyleXStyles } from '@stylexjs/stylex'
import type { ComponentProps, ReactNode } from 'react'
import type { IconComponent } from '~/lib/icon'
import { Button as BaseButton } from '@base-ui/react/button'
import * as stylex from '@stylexjs/stylex'
import { useSizeVariant } from '~/context/size'
import { trim } from '~/theme/text'
import { buttonMarker } from './marker.stylex'
import { styles } from './style'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost'
export type ButtonSize = 'default' | 'compact' | 'icon' | 'icon-compact'

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, 'className' | 'style' | 'children'> {
  variant?: ButtonVariant
  /**
   * Omitted, the button follows the surrounding SizeProvider (default 36px,
   *  compact 28px).
   */
  size?: ButtonSize
  loading?: boolean
  leadingIcon?: IconComponent
  trailingIcon?: IconComponent
  /**
   * Force the visual pressed/held state. Useful when the button drives an
   *  external open piece of UI (a popover, menu) so it reads as engaged while
   *  it is showing.
   */
  active?: boolean
  children?: ReactNode
  xstyle?: StyleXStyles
}

const surfaceByVariant = {
  primary: styles.surfacePrimary,
  secondary: styles.surfaceSecondary,
  tertiary: styles.surfaceTertiary,
  ghost: styles.surfaceGhost,
}

const forcedByVariant = {
  primary: styles.forcedPrimary,
  secondary: styles.forcedSecondary,
  tertiary: styles.forcedTertiary,
  ghost: styles.forcedGhost,
}

const sizeStyles = {
  'default': styles.sizeDefault,
  'compact': styles.sizeCompact,
  'icon': styles.sizeIcon,
  'icon-compact': styles.sizeIconCompact,
}

interface ButtonContentProps {
  loading: boolean
  iconOnly: boolean
  compact: boolean
  leadingIcon?: IconComponent
  trailingIcon?: IconComponent
  children: ReactNode
}

function ButtonContent({
  loading,
  iconOnly,
  compact,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  children,
}: ButtonContentProps) {
  const iconSize = compact ? 14 : 16
  const showLeading = !iconOnly && !!LeadingIcon
  const showTrailing = !iconOnly && !!TrailingIcon

  if (loading) {
    return (
      <>
        <span {...stylex.props(styles.hiddenWhileLoading)}>
          {showLeading && LeadingIcon && <LeadingIcon size={iconSize} strokeWidth={2} />}
          {children}
          {showTrailing && TrailingIcon && <TrailingIcon size={iconSize} strokeWidth={2} />}
        </span>
        <span {...stylex.props(styles.spinnerWrap)}>
          <svg
            {...stylex.props(compact ? styles.spinnerCompact : styles.spinnerDefault)}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              {...stylex.props(styles.spinnerPath)}
              d="M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
              stroke="currentColor"
              strokeWidth="1.125"
              strokeLinecap="round"
              pathLength="100"
            />
          </svg>
        </span>
      </>
    )
  }

  if (iconOnly)
    return children

  return (
    <>
      {showLeading && LeadingIcon && (
        <LeadingIcon size={iconSize} strokeWidth={1.5} className="ps-icon-stroke" />
      )}
      <span {...stylex.props(trim.capAlphabetic)}>{children}</span>
      {showTrailing && TrailingIcon && (
        <TrailingIcon size={iconSize} strokeWidth={1.5} className="ps-icon-stroke" />
      )}
    </>
  )
}

export function Button({
  variant = 'primary',
  size,
  loading = false,
  leadingIcon,
  trailingIcon,
  active = false,
  disabled,
  children,
  xstyle,
  ...props
}: ButtonProps) {
  // Explicit prop > surrounding SizeProvider > default.
  const contextSize = useSizeVariant()
  const resolvedSize: ButtonSize = size ?? (contextSize === 'compact' ? 'compact' : 'default')
  const iconOnly = resolvedSize === 'icon' || resolvedSize === 'icon-compact'
  const compact = resolvedSize === 'compact' || resolvedSize === 'icon-compact'

  const rootProps = stylex.props(
    buttonMarker,
    styles.root,
    styles[variant],
    sizeStyles[resolvedSize],
    !iconOnly && leadingIcon && (compact ? styles.iconLeftCompact : styles.iconLeftDefault),
    !iconOnly && trailingIcon && (compact ? styles.iconRightCompact : styles.iconRightDefault),
    xstyle,
  )

  return (
    <BaseButton
      {...props}
      {...rootProps}
      disabled={disabled || loading}
      data-icon-only={iconOnly ? (compact ? 'compact' : 'default') : undefined}
    >
      <span
        aria-hidden
        {...stylex.props(
          styles.surface,
          active ? forcedByVariant[variant] : surfaceByVariant[variant],
        )}
      />
      <span {...stylex.props(styles.content)}>
        <ButtonContent
          loading={loading}
          iconOnly={iconOnly}
          compact={compact}
          leadingIcon={leadingIcon}
          trailingIcon={trailingIcon}
        >
          {children}
        </ButtonContent>
      </span>
    </BaseButton>
  )
}
