import { animate, useMotionValue } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { infoSidebarCollapsedAtom, infoSidebarWidthAtom } from '~/atoms/layout'
import { panelTransition } from '~/lib/panel-motion'

/**
 * The info panel's visible width as a motion value: the panel and the column
 * beside it both read it, so they move together. Collapsing and expanding
 * tween it; dragging the resize handle sets it directly (no tween, the width
 * follows the pointer). `hidden` (a tab with no folder, which has nothing to
 * show in the panel) takes it to 0 at once, like the tab's content switching.
 */
export function useInfoPanelExtent(hidden: boolean) {
  const width = useAtomValue(infoSidebarWidthAtom)
  const collapsed = useAtomValue(infoSidebarCollapsedAtom)
  const extent = useMotionValue(collapsed || hidden ? 0 : width)

  // Only a collapse toggle animates; a width change must not restart it.
  const widthRef = useRef(width)
  const collapsedRef = useRef(collapsed)
  const hiddenRef = useRef(hidden)
  useEffect(() => {
    widthRef.current = width
    collapsedRef.current = collapsed
    hiddenRef.current = hidden
  })
  useEffect(() => {
    if (hiddenRef.current)
      return
    const controls = animate(extent, collapsed ? 0 : widthRef.current, panelTransition())
    return () => controls.stop()
  }, [collapsed, extent])
  useEffect(() => {
    extent.jump(hidden || collapsedRef.current ? 0 : widthRef.current)
  }, [hidden, extent])

  return extent
}
