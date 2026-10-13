import type { AnimationPlaybackControls, MotionValue } from 'framer-motion'
import * as stylex from '@stylexjs/stylex'
import { animate, motion } from 'framer-motion'
import { useAtom } from 'jotai'
import { useRef, useState } from 'react'
import {
  INFO_SIDEBAR_COLLAPSE_THRESHOLD,
  INFO_SIDEBAR_DEFAULT_WIDTH,
  INFO_SIDEBAR_MAX_WIDTH,
  INFO_SIDEBAR_MIN_WIDTH,
  infoSidebarCollapsedAtom,
  infoSidebarWidthAtom,
  panelMaxWidth,
} from '~/atoms/layout'
import { panelTransition } from '~/lib/panel-motion'
import { colors } from '~/theme/colors.stylex'
import { InfoSidebar } from './InfoSidebar'

const KEY_STEP = 16
/** Content shrinks a touch while the panel folds away, toward the window edge. */
const COLLAPSED_SCALE = 0.97

const styles = stylex.create({
  // The visible box: its width is the animated extent and it clips the
  // content, which keeps its full width the whole time (so nothing reflows
  // while the panel slides).
  frame: {
    position: 'fixed',
    right: 0,
    bottom: 0,
    overflow: 'clip',
  },
  content: {
    position: 'absolute',
    top: 0,
    right: 0,
    overflowY: 'auto',
    boxSizing: 'border-box',
    height: '100%',
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: colors['--ps-border'],
    backgroundColor: colors['--ps-background'],
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    width: 6,
    cursor: 'col-resize',
    touchAction: 'none',
    backgroundColor: { 'default': 'transparent', ':hover': colors['--ps-active'] },
    transitionProperty: 'background-color',
    transitionDuration: '120ms',
  },
  handleDragging: { backgroundColor: colors['--ps-selected'] },
})

interface InfoPanelProps {
  /** Visible width, animated by the parent so the neighbouring column follows. */
  extent: MotionValue<number>
  /** Where the panel starts: below the tab bar, which spans the window. */
  top: number
  /** Space above the content, so it starts level with the grid. */
  paddingTop: number
}

export function InfoPanel({ extent, top, paddingTop }: InfoPanelProps) {
  const [width, setWidth] = useAtom(infoSidebarWidthAtom)
  const [collapsed, setCollapsed] = useAtom(infoSidebarCollapsedAtom)
  const [dragging, setDragging] = useState(false)

  // Within its own bounds, and leaving the grid its minimum width.
  function clamp(value: number) {
    const max = panelMaxWidth(
      { min: INFO_SIDEBAR_MIN_WIDTH, max: INFO_SIDEBAR_MAX_WIDTH },
      window.innerWidth,
    )
    return Math.min(max, Math.max(INFO_SIDEBAR_MIN_WIDTH, value))
  }
  const dragStartRef = useRef({ x: 0, width: 0 })

  // Dragging past the collapse threshold previews the collapse (the panel
  // tweens shut under the pointer); letting go there commits it, dragging
  // back out restores the width.
  const pastThresholdRef = useRef(false)
  const tweenRef = useRef<AnimationPlaybackControls | null>(null)

  function tweenTo(target: number) {
    tweenRef.current?.stop()
    const controls = animate(extent, target, panelTransition())
    tweenRef.current = controls
    controls.then(() => {
      if (tweenRef.current === controls)
        tweenRef.current = null
    })
  }

  function resize(next: number) {
    const value = clamp(next)
    setWidth(value)
    extent.set(value)
  }

  function drag(raw: number) {
    const past = raw < INFO_SIDEBAR_COLLAPSE_THRESHOLD
    if (past !== pastThresholdRef.current) {
      pastThresholdRef.current = past
      tweenTo(past ? 0 : clamp(raw))
    }
    if (past)
      return
    const value = clamp(raw)
    setWidth(value)
    // While the preview tween runs it owns the extent.
    if (!tweenRef.current)
      extent.set(value)
  }

  function endDrag(commit: boolean) {
    setDragging(false)
    const past = pastThresholdRef.current
    pastThresholdRef.current = false
    if (past && commit)
      setCollapsed(true)
    else if (past)
      tweenTo(width)
  }

  return (
    <motion.aside className={stylex.props(styles.frame).className} style={{ top, width: extent }}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整信息栏宽度"
        aria-valuemin={INFO_SIDEBAR_MIN_WIDTH}
        aria-valuemax={INFO_SIDEBAR_MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={collapsed ? -1 : 0}
        {...stylex.props(styles.handle, dragging && styles.handleDragging)}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          dragStartRef.current = { x: e.clientX, width }
          setDragging(true)
        }}
        onPointerMove={(e) => {
          if (dragging)
            drag(dragStartRef.current.width + dragStartRef.current.x - e.clientX)
        }}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onDoubleClick={() => resize(INFO_SIDEBAR_DEFAULT_WIDTH)}
        onKeyDown={(e) => {
          // The panel grows to the left, so ArrowLeft widens it.
          if (e.key === 'ArrowLeft')
            resize(width + KEY_STEP)
          else if (e.key === 'ArrowRight')
            resize(width - KEY_STEP)
          else
            return
          e.preventDefault()
        }}
      />
      <motion.div
        inert={collapsed}
        animate={{ scale: collapsed ? COLLAPSED_SCALE : 1 }}
        transition={panelTransition()}
        className={stylex.props(styles.content).className}
        style={{ transformOrigin: 'right center', width, paddingTop }}
      >
        <InfoSidebar />
      </motion.div>
    </motion.aside>
  )
}
