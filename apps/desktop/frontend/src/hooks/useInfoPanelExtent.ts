import { animate, useMotionValue } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { infoSidebarCollapsedAtom, infoSidebarWidthAtom } from '~/atoms/layout'
import { panelTransition } from '~/lib/panel-motion'

/**
 * The info panel's visible width as a motion value: the panel and the column
 * beside it both read it, so they move together. Collapsing and expanding
 * tween it; dragging the resize handle sets it directly (no tween, the width
 * follows the pointer).
 */
export function useInfoPanelExtent() {
  const width = useAtomValue(infoSidebarWidthAtom)
  const collapsed = useAtomValue(infoSidebarCollapsedAtom)
  const extent = useMotionValue(collapsed ? 0 : width)

  // Only a collapse toggle animates; a width change must not restart it.
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  })
  useEffect(() => {
    const controls = animate(extent, collapsed ? 0 : widthRef.current, panelTransition())
    return () => controls.stop()
  }, [collapsed, extent])

  return extent
}
