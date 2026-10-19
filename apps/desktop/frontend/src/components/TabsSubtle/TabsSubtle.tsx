import type { StyleXStyles } from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react'
import { useSize } from '~/context/size'
import { useFluidHover } from '~/hooks/use-fluid-hover'
import { spring } from '~/lib/springs'
import { trim, weight } from '~/theme/text'
import { styles } from './style'

interface TabsSubtleContextValue {
  registerTab: (index: number, element: HTMLElement | null) => void
  hoveredIndex: number | null
  selectedIndex: number
}

const TabsSubtleContext = createContext<TabsSubtleContextValue | null>(null)

function useTabsSubtle() {
  const ctx = use(TabsSubtleContext)
  if (!ctx)
    throw new Error('useTabsSubtle must be used within a TabsSubtle')
  return ctx
}

export interface TabsSubtleProps {
  children: ReactNode
  selectedIndex: number
  onSelect: (index: number) => void
  xstyle?: StyleXStyles
}

/**
 * A row of text tabs over a sliding selection pill and a hover pill that
 * springs between tabs. Base UI owns role="tablist", roving tabindex and
 * Arrow/Home/End keyboard navigation; arrows move focus and Enter/Space selects
 * (manual activation). The pills are measured from the tabs' DOM rects.
 */
export function TabsSubtle({ children, selectedIndex, onSelect, xstyle }: TabsSubtleProps) {
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
      if (element)
        tabElementsRef.current.set(index, element)
      else
        tabElementsRef.current.delete(index)
    },
    [registerItem],
  )

  useEffect(() => {
    measureTabs()
  }, [measureTabs, children])

  // Observe individual tabs for resize (label changes, e.g. counts).
  useEffect(() => {
    const elements = tabElementsRef.current
    if (elements.size === 0)
      return
    const ro = new ResizeObserver(() => measureTabs())
    elements.forEach(el => ro.observe(el))
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
      <Tabs.Root
        value={selectedIndex}
        onValueChange={value => onSelect(Number(value))}
        {...stylex.props(styles.root)}
      >
        <Tabs.List
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
            const indexAttr = (e.target as HTMLElement)
              .closest<HTMLElement>('[data-fluid-hover-index]')
              ?.dataset
              .fluidHoverIndex
            if (indexAttr != null) {
              const idx = Number(indexAttr)
              setHoveredIndex(idx)
              setFocusedIndex((e.target as HTMLElement).matches(':focus-visible') ? idx : null)
            }
          }}
          onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
            if (containerRef.current?.contains(e.relatedTarget))
              return
            setFocusedIndex(null)
            if (mouseInsideRef.current)
              return
            setHoveredIndex(null)
          }}
          {...stylex.props(styles.list, xstyle)}
        >
          {/* Selected pill */}
          {selectedRect !== undefined && (
            <motion.div
              {...stylex.props(styles.pill)}
              initial={false}
              animate={{
                left: selectedRect.left,
                width: selectedRect.width,
                top: selectedRect.top,
                height: selectedRect.height,
                opacity: isHovering ? 0.8 : 1,
              }}
              transition={{ ...spring.moderate, opacity: { duration: 0.08 } }}
            />
          )}

          {/* Hover pill */}
          <AnimatePresence>
            {hoverRect && !isHoveringSelected && selectedRect !== undefined && (
              <motion.div
                {...stylex.props(styles.pill)}
                initial={{
                  left: selectedRect.left,
                  width: selectedRect.width,
                  top: selectedRect.top,
                  height: selectedRect.height,
                  opacity: 0,
                }}
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
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>

          {/* Focus ring */}
          <AnimatePresence>
            {focusRect && (
              <motion.div
                {...stylex.props(styles.focusRing)}
                initial={false}
                animate={{
                  left: focusRect.left - 2,
                  top: focusRect.top - 2,
                  width: focusRect.width + 4,
                  height: focusRect.height + 4,
                }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
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
  label: string
  index: number
  /** Fades the label while neither hovered nor selected, e.g. for a filter that would show nothing. */
  dimmed?: boolean
}

export function TabsSubtleItem({ label, index, dimmed = false }: TabsSubtleItemProps) {
  const internalRef = useRef<HTMLElement | null>(null)
  const size = useSize()
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
      // Fixed heights (was py-2 around a 19.5px line box ≈ 35.5px) so the
      // text-box trim on the label doesn't shrink the tab.
      {...stylex.props(styles.tab, size.control, size.px, size.gap)}
    >
      <span {...stylex.props(styles.label, size.text)}>
        <span
          {...stylex.props(styles.labelSizer, weight.semibold, trim.capAlphabetic)}
          aria-hidden="true"
        >
          {label}
        </span>
        <span
          {...stylex.props(
            styles.labelText,
            trim.capAlphabetic,
            isActive ? styles.active : styles.inactive,
            dimmed && !isActive && styles.dimmed,
            isSelected ? weight.semibold : weight.normal,
          )}
        >
          {label}
        </span>
      </span>
    </Tabs.Tab>
  )
}
