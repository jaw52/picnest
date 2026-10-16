import { createContext } from 'react'

/**
 * The element the grid scrolls in: each tab has one of its own, so a tab
 * switched back to is where it was left. Null until it mounts.
 */
export const ScrollContainerContext = createContext<HTMLElement | null>(null)
