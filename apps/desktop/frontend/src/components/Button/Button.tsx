import { Button as BaseButton } from '@base-ui/react/button'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '~/lib/cn'
import type { IconComponent } from '~/lib/icon'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive'
type ButtonSize = 'compact' | 'icon'

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, 'className' | 'children'> {
  /**
   * Force the visual pressed/held state. Useful when the button drives an
   *  external open piece of UI (a popover, menu) so it reads as engaged while
   *  it is showing.
   */
  active?: boolean
  children?: ReactNode
  className?: string
  leadingIcon?: IconComponent
  loading?: boolean
  size?: ButtonSize
  trailingIcon?: IconComponent
  variant?: ButtonVariant
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-text text-background hover:opacity-90 active:opacity-80',
  // Primary's recipe in the destructive color, for actions that remove files.
  destructive: 'bg-red text-white hover:opacity-90 active:opacity-80',
  secondary: 'bg-fill-secondary text-text hover:bg-fill-tertiary active:bg-fill-quaternary',
  tertiary: 'text-text ring-1 ring-border hover:bg-text/5 active:bg-text/10',
  ghost: 'text-text-secondary hover:bg-text/5 hover:text-text active:bg-text/10',
}

// Forced-active (`active` prop): the pressed look at rest.
const forcedClass: Record<ButtonVariant, string> = {
  primary: 'opacity-80',
  destructive: 'opacity-80',
  secondary: 'bg-fill-quaternary',
  tertiary: 'bg-text/10',
  ghost: 'bg-text/10 text-text',
}

const sizeClass: Record<ButtonSize, string> = {
  compact: 'h-7 gap-1 px-3 text-body',
  icon: 'size-7 p-0',
}

const ICON_SIZE = 14

interface ButtonContentProps {
  children: ReactNode
  iconOnly: boolean
  leadingIcon?: IconComponent
  loading: boolean
  trailingIcon?: IconComponent
}

function ButtonContent({
  loading,
  iconOnly,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  children,
}: ButtonContentProps) {
  const Leading = iconOnly ? undefined : LeadingIcon
  const Trailing = iconOnly ? undefined : TrailingIcon

  if (loading) {
    return (
      <>
        <span className="flex items-center justify-center gap-[inherit] opacity-0">
          {Leading && <Leading height={ICON_SIZE} width={ICON_SIZE} />}
          {children}
          {Trailing && <Trailing height={ICON_SIZE} width={ICON_SIZE} />}
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="size-7" fill="none" viewBox="0 0 24 24">
            <path
              className="animate-spinner [stroke-dasharray:15_85]"
              d="M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
              pathLength="100"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.125"
            />
          </svg>
        </span>
      </>
    )
  }

  if (iconOnly) return children

  return (
    <>
      {Leading && <Leading height={ICON_SIZE} width={ICON_SIZE} />}
      <span className="text-trim">{children}</span>
      {Trailing && <Trailing height={ICON_SIZE} width={ICON_SIZE} />}
    </>
  )
}

export function Button({
  variant = 'primary',
  size = 'compact',
  loading = false,
  leadingIcon,
  trailingIcon,
  active = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const iconOnly = size === 'icon'

  return (
    <BaseButton
      {...props}
      data-icon-only={iconOnly ? '' : undefined}
      disabled={disabled || loading}
      className={cn(
        'relative isolate inline-flex items-center justify-center rounded-item transition-colors duration-80 outline-none select-none disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        active && forcedClass[variant],
        sizeClass[size],
        // An icon sits 4px closer to its edge than text does.
        !iconOnly && leadingIcon && 'pl-2',
        !iconOnly && trailingIcon && 'pr-2',
        className,
      )}
    >
      <span className="relative inline-flex items-center justify-center gap-[inherit]">
        <ButtonContent iconOnly={iconOnly} leadingIcon={leadingIcon} loading={loading} trailingIcon={trailingIcon}>
          {children}
        </ButtonContent>
      </span>
    </BaseButton>
  )
}
