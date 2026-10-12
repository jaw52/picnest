import type { ReactNode } from 'react'
import { SurfaceContext } from './context'

export function SurfaceProvider({ value, children }: { value: number, children: ReactNode }) {
  // Clamped to the ladder: a deep stack keeps resolving to a real surface token.
  return <SurfaceContext value={Math.max(1, Math.min(8, value))}>{children}</SurfaceContext>
}
