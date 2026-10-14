import { animate, useMotionValue } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { infoSidebarCollapsedAtom, infoSidebarWidthAtom } from '~/atoms/layout'
import { panelTransition } from '~/lib/panel-motion'

/**
 * The info panel's visible width as a motion value: the panel and the column
 * beside it both read it, so they move together. Collapsing and expanding
 * tween it; dragging the resize handle sets it directly (no tween, the width
 * follows the pointer). Switching what the tab shows (`tabPath`) drops the
 * selection, so it collapses the panel at once, like the tab's content
 * switching: a tween there would reflow the incoming grid on every frame.
 */
export function useInfoPanelExtent(tabPath: string | null) {
  const width = useAtomValue(infoSidebarWidthAtom)
  const [collapsed, setCollapsed] = useAtom(infoSidebarCollapsedAtom)
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
  useEffect(() => {
    // The tween this starts runs from 0 to 0, so the jump is what shows.
    setCollapsed(true)
    extent.jump(0)
  }, [tabPath, setCollapsed, extent])

  return extent
}
