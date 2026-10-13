import type { ButtonProps } from '~/components/Button'
import type { IconComponent } from '~/lib/icon'
import { Button } from '~/components/Button'
import { Tooltip } from '~/components/Tooltip'

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  /** Accessible name, also shown as the tooltip. */
  label: string
  icon: IconComponent
  iconClassName?: string
}

/** An icon-only ghost button with its label in a tooltip. */
export function IconButton({
  label,
  icon: Icon,
  iconClassName,
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <Button variant={variant} size="icon-compact" aria-label={label} {...props}>
        <Icon className={iconClassName} />
      </Button>
    </Tooltip>
  )
}
