import { use } from 'react'
import { ScrollContainerContext } from './context'

export function useScrollContainer(): HTMLElement | null {
  return use(ScrollContainerContext)
}
