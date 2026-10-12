import type { ComponentType } from 'react'

export interface IconComponentProps {
  size?: number | string
  strokeWidth?: number | string
  className?: string
}

/** Any icon component taking lucide's size/strokeWidth props. */
export type IconComponent = ComponentType<IconComponentProps>
