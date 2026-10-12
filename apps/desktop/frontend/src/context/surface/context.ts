import { createContext } from 'react'

/**
 * The surface level the children sit on, on an 8-step ladder (1 is the page).
 * Raised components (menus, popovers) read it and pick their own level relative
 * to it, so a menu never melts into the panel it opens over.
 */
export const SurfaceContext = createContext<number>(1)
