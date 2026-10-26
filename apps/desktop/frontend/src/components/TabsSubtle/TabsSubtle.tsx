import { Tabs } from '@base-ui/react/tabs'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react'

import { useFluidHover } from '~/hooks/use-fluid-hover'
import { cn } from '~/lib/cn'
import { spring } from '~/lib/springs'

interface TabsSubtleContextValue {
  hoveredIndex: number | null
  registerTab: (index: number, element: HTMLElement | null) => void
  selectedIndex: number
}

const TabsSubtleContext = createContext<TabsSubtleContextValue | null>(null)

function useTabsSubtle() {
  const ctx = use(TabsSubtleContext)
  if (!ctx) throw new Error('useTabsSubtle must be used within a TabsSubtle')
  return ctx
}

export interface TabsSubtleProps {
  children: ReactNode
  className?: string
  onSelect: (index: number) => void
  selectedIndex: number
}

/**
 * A row of text tabs over a sliding selection pill and a hover pill that
 * springs between tabs. Base UI owns role="tablist", roving tabindex and
 * Arrow/Home/End keyboard navigation; arrows move focus and Enter/Space selects
 * (manual activation). The pills are measured from the tabs' DOM rects.
 */
export function TabsSubtle({ children, selectedIndex, onSelect, className }: TabsSubtleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Whether the pointer is over the list: a ref for blur, which reads it at the
  // moment it runs, and the same flag as state for the render, which picks the
  // hover pill's exit from it. Both flip in the same handlers.
  const mouseInsideRef = useRef(false)
  const [mouseInside, setMouseInside] = useState(false)

  const {
    activeIndex: hoveredIndex,
    setActiveIndex: setHoveredIndex,
    itemRects: tabRects,
    handlers,
    registerItem,
    measureItems: measureTabs,
  } = useFluidHover(containerRef, { axis: 'x' })

  const tabElementsRef = useRef(new Map<number, HTMLElement>())
  const registerTab = useCallback(
    (index: number, element: HTMLElement | null) => {
      registerItem(index, element)
      if (element) tabElementsRef.current.set(index, element)
      else tabElementsRef.current.delete(index)
    },
    [registerItem],
  )

  useEffect(() => {
    measureTabs()
  }, [measureTabs, children])

  // Observe individual tabs for resize (label changes, e.g. counts).
  useEffect(() => {
    const elements = tabElementsRef.current
    if (elements.size === 0) return
    const ro = new ResizeObserver(() => measureTabs())
    elements.forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [measureTabs, children])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      mouseInsideRef.current = true
      setMouseInside(true)
      handlers.onMouseMove(e)
    },
    [handlers],
  )

  const handleMouseLeave = useCallback(() => {
    mouseInsideRef.current = false
    setMouseInside(false)
    handlers.onMouseLeave()
  }, [handlers])

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const selectedRect = tabRects[selectedIndex]
  const hoverRect = hoveredIndex === null ? null : tabRects[hoveredIndex]
  const focusRect = focusedIndex === null ? null : tabRects[focusedIndex]
  const isHoveringSelected = hoveredIndex === selectedIndex
  const isHovering = hoveredIndex !== null && !isHoveringSelected

  return (
    <TabsSubtleContext value={{ registerTab, hoveredIndex, selectedIndex }}>
      <Tabs.Root className="contents" value={selectedIndex} onValueChange={(value) => onSelect(Number(value))}>
        <Tabs.List
          ref={containerRef}
          className={cn(
            '-m-1 relative flex max-w-[calc(100%+8px)] min-w-0 items-center overflow-x-auto p-1 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            className,
          )}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
            if (containerRef.current?.contains(e.relatedTarget)) return
            setFocusedIndex(null)
            if (mouseInsideRef.current) return
            setHoveredIndex(null)
          }}
          // The negative margins and matching padding give the 2px-outset focus ring
          // room inside overflow-x. The max-width allows for the margins, so the first
          // and last tab's ring is not clipped.
          onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
            const indexAttr = (e.target as HTMLElement).closest<HTMLElement>('[data-fluid-hover-index]')?.dataset
              .fluidHoverIndex
            if (indexAttr != null) {
              const idx = Number(indexAttr)
              setHoveredIndex(idx)
              setFocusedIndex((e.target as HTMLElement).matches(':focus-visible') ? idx : null)
            }
          }}
        >
          {/* Selected pill */}
          {selectedRect !== undefined && (
            <motion.div
              className="pointer-events-none absolute rounded-item bg-text/10"
              initial={false}
              transition={{ ...spring.moderate, opacity: { duration: 0.08 } }}
              animate={{
                left: selectedRect.left,
                width: selectedRect.width,
                top: selectedRect.top,
                height: selectedRect.height,
                opacity: isHovering ? 0.8 : 1,
              }}
            />
          )}

          {/* Hover pill */}
          <AnimatePresence>
            {hoverRect && !isHoveringSelected && selectedRect !== undefined && (
              <motion.div
                className="pointer-events-none absolute rounded-item bg-text/10"
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
                animate={{
                  left: hoverRect.left,
                  width: hoverRect.width,
                  top: hoverRect.top,
                  height: hoverRect.height,
                  opacity: 0.4,
                }}
                exit={
                  !mouseInside && selectedRect !== undefined
                    ? {
                        left: selectedRect.left,
                        width: selectedRect.width,
                        top: selectedRect.top,
                        height: selectedRect.height,
                        opacity: 0,
                        transition: { ...spring.moderate, opacity: { duration: 0.06 } },
                      }
                    : { opacity: 0, transition: spring.fast.exit }
                }
                initial={{
                  left: selectedRect.left,
                  width: selectedRect.width,
                  top: selectedRect.top,
                  height: selectedRect.height,
                  opacity: 0,
                }}
              />
            )}
          </AnimatePresence>

          {/* Focus ring */}
          <AnimatePresence>
            {focusRect && (
              <motion.div
                className="pointer-events-none absolute z-20 rounded-[10px] border border-accent"
                exit={{ opacity: 0, transition: spring.fast.exit }}
                initial={false}
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
                animate={{
                  left: focusRect.left - 2,
                  top: focusRect.top - 2,
                  width: focusRect.width + 4,
                  height: focusRect.height + 4,
                }}
              />
            )}
          </AnimatePresence>

          {children}
        </Tabs.List>
      </Tabs.Root>
    </TabsSubtleContext>
  )
}

export interface TabsSubtleItemProps {
  /** Fades the label while neither hovered nor selected, e.g. for a filter that would show nothing. */
  dimmed?: boolean
  index: number
  label: string
}

export function TabsSubtleItem({ label, index, dimmed = false }: TabsSubtleItemProps) {
  const internalRef = useRef<HTMLElement | null>(null)
  const { registerTab, hoveredIndex, selectedIndex } = useTabsSubtle()

  useEffect(() => {
    registerTab(index, internalRef.current)
    return () => registerTab(index, null)
  }, [index, registerTab])

  const isSelected = selectedIndex === index
  const isActive = hoveredIndex === index || isSelected

  return (
    <Tabs.Tab
      ref={internalRef}
      value={index}
      data-fluid-hover-index={index}
      // Fixed height so the text-box trim on the label doesn't shrink the tab.
      className="relative z-10 flex h-7 items-center gap-1 rounded-item bg-transparent px-2.5 outline-none"
    >
      {/* Tabular figures, so a changing count doesn't nudge the tabs after it. */}
      <span className="inline-grid text-body whitespace-nowrap tabular-nums">
        {/* Both stacked spans carry the text-box trim so the invisible bold sizer
         * and the visible label keep identical boxes. */}
        <span aria-hidden="true" className="wght-semibold text-trim invisible col-start-1 row-start-1">
          {label}
        </span>
        <span
          className={cn(
            'text-trim col-start-1 row-start-1 transition-[color,font-variation-settings] duration-80',
            isActive ? 'text-text' : 'text-text-secondary',
            dimmed && !isActive && 'opacity-45',
            isSelected ? 'wght-semibold' : 'wght-normal',
          )}
        >
          {label}
        </span>
      </span>
    </Tabs.Tab>
  )
}
