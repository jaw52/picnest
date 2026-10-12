import { use } from 'react'
import { SurfaceContext } from './context'

export function useSurface(): number {
  return use(SurfaceContext)
}
