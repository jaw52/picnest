import { atomWithStorage } from 'jotai/utils'

export const INFO_SIDEBAR_MIN_WIDTH = 220
export const INFO_SIDEBAR_MAX_WIDTH = 480
export const INFO_SIDEBAR_DEFAULT_WIDTH = 260
/** Dragging the panel narrower than this collapses it on release. */
export const INFO_SIDEBAR_COLLAPSE_THRESHOLD = 160

/**
 * Read on init: the panel's animated width starts from these, so a late
 * storage read would play a spurious collapse/expand on launch.
 */
export const infoSidebarWidthAtom = atomWithStorage(
  'picnest.infoSidebarWidth',
  INFO_SIDEBAR_DEFAULT_WIDTH,
  undefined,
  { getOnInit: true },
)
/** Collapsed until something is selected: an empty panel would only take room from the grid. */
export const infoSidebarCollapsedAtom = atomWithStorage(
  'picnest.infoSidebarCollapsed',
  true,
  undefined,
  { getOnInit: true },
)

/** The photo grid keeps at least this much width, whatever the side panel asks for. */
export const MAIN_MIN_WIDTH = 360

/**
 * How wide a side panel may get: its own maximum, less whatever the window
 * can't spare once the grid's minimum is accounted for. Never below the
 * panel's own minimum, which wins on a very narrow window.
 */
export function panelMaxWidth(own: { min: number, max: number }, windowWidth: number) {
  return Math.max(own.min, Math.min(own.max, windowWidth - MAIN_MIN_WIDTH))
}
