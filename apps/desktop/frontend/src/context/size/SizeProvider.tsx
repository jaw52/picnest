import type { ReactNode } from 'react'
import type { SizeVariant } from './context'
import { SizeContext } from './context'

/** Pins a whole region to one step of the size ladder. */
export function SizeProvider({ size, children }: { size: SizeVariant, children: ReactNode }) {
  return <SizeContext value={size}>{children}</SizeContext>
}
