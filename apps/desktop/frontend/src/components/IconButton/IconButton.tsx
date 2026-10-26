import type { ButtonProps } from '~/components/Button'
import { Button } from '~/components/Button'
import { Tooltip } from '~/components/Tooltip'
import type { IconComponent } from '~/lib/icon'

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  icon: IconComponent
  iconClassName?: string
  /** Accessible name, also shown as the tooltip. */
  label: string
}

/** An icon-only ghost button with its label in a tooltip. */
export function IconButton({ label, icon: Icon, iconClassName, variant = 'ghost', ...props }: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <Button aria-label={label} size="icon" variant={variant} {...props}>
        <Icon className={iconClassName} />
      </Button>
    </Tooltip>
  )
}
