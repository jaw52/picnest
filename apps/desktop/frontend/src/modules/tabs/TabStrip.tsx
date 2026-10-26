import { useAtomValue } from 'jotai'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { folderNameFromPath } from '~/atoms/recentFolders'
import { tabsStateAtom } from '~/atoms/tabs'
import { ContextMenu } from '~/components/ContextMenu'
import { FluidHoverHighlight } from '~/components/FluidHoverHighlight'
import { IconButton } from '~/components/IconButton'
import { useFluidHover } from '~/hooks/use-fluid-hover'
import { useIsICloudFolder } from '~/hooks/useIsICloudFolder'
import { useTabs } from '~/hooks/useTabs'
import { cn } from '~/lib/cn'
import { isLibraryPath } from '~/lib/library'
import { spring } from '~/lib/springs'
import type { Tab } from '~/lib/tabs'
import AddRegular from '~icons/mingcute/add-line'
import AlignArrowRightRegular from '~icons/mingcute/align-arrow-right-line'
import CloseRegular from '~icons/mingcute/close-line'
import CloseSquareRegular from '~icons/mingcute/close-square-line'
import CloudFilled from '~icons/mingcute/cloud-fill'
import CloudRegular from '~icons/mingcute/cloud-line'
import FolderFilled from '~icons/mingcute/folder-fill'
import FolderRegular from '~icons/mingcute/folder-line'
import LayoutGridFilled from '~icons/mingcute/layout-grid-fill'
import LayoutGridRegular from '~icons/mingcute/layout-grid-line'
import PicFilled from '~icons/mingcute/pic-fill'
import PicRegular from '~icons/mingcute/pic-line'

import { pathMenuItems } from './pathMenuItems'

/**
 * The new-tab page's grid, the Photos library, or where a folder lives:
 * iCloud Drive or this Mac.
 * Until that is known, an empty space the icon's size, so the title doesn't
 * shift when it arrives.
 */
const TAB_ICONS = {
  newTab: [LayoutGridRegular, LayoutGridFilled],
  iCloud: [CloudRegular, CloudFilled],
  local: [FolderRegular, FolderFilled],
  library: [PicRegular, PicFilled],
} as const

function tabKind(path: string | null, library: boolean, iCloud: boolean | undefined): keyof typeof TAB_ICONS {
  if (path === null) return 'newTab'
  if (library) return 'library'
  return iCloud ? 'iCloud' : 'local'
}

function TabIcon({ path, active }: { path: string | null; active: boolean }) {
  const iCloud = useIsICloudFolder(path)
  const library = isLibraryPath(path)
  if (path !== null && !library && iCloud === undefined) return <span className="size-3.5 shrink-0" />
  const Icon = TAB_ICONS[tabKind(path, library, iCloud)][active ? 1 : 0]
  return <Icon className="shrink-0" height={14} width={14} />
}

interface TabItemProps {
  active: boolean
  index: number
  isLast: boolean
  isOnly: boolean
  registerItem: (index: number, element: HTMLElement | null) => void
  tab: Tab
}

function TabItem({ tab, index, active, isOnly, isLast, registerItem }: TabItemProps) {
  const { t } = useTranslation()
  const { activateTab, closeTab, closeOtherTabs, closeTabsToRight } = useTabs()
  const title =
    tab.path === null ? t('common.newTab') : isLibraryPath(tab.path) ? t('library.name') : folderNameFromPath(tab.path)

  // A closed tab leaves its slot as it starts fading out, in the same commit
  // the tabs after it move down a slot, so it never clears its successor's.
  const ref = useRef<HTMLDivElement>(null)
  const isPresent = useIsPresent()
  useEffect(() => {
    if (!isPresent) return
    registerItem(index, ref.current)
    return () => registerItem(index, null)
  }, [index, isPresent, registerItem])

  const item = (
    <motion.div
      animate={{ opacity: 1 }}
      aria-selected={active}
      data-fluid-hover-index={index}
      exit={{ opacity: 0, transition: spring.moderate.exit }}
      initial={{ opacity: 0 }}
      layout="position"
      ref={ref}
      role="tab"
      transition={spring.moderate}
      // Tabs share the row evenly and shrink together, like a browser's. Centered
      // on the active tab, which reaches down to the page (mb-[3px]: how far a
      // hovered tab keeps from the bar's bottom edge and from the active tab).
      className={cn(
        'group/tab relative mb-[3px] flex h-7 w-45 min-w-18 shrink cursor-default items-center gap-1.5 pr-1 pl-2.5 text-caption transition-colors duration-80',
        active ? 'text-text' : 'text-text-secondary',
      )}
      onMouseDown={(e) => {
        // Middle click closes, like a browser.
        if (e.button === 1) {
          e.preventDefault()
          closeTab(tab.id)
        } else if (e.button === 0) {
          activateTab(tab.id)
        }
      }}
    >
      <TabIcon active={active} path={tab.path} />
      <span className={cn('min-w-0 grow basis-0 truncate', active ? 'wght-semibold' : 'wght-normal')}>{title}</span>
      <button
        type="button"
        onClick={() => closeTab(tab.id)}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={t('tabs.closeTab', { title })}
        // Only the active tab and the hovered one offer their close button.
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md p-0 text-text-secondary transition-[opacity,color,background-color] duration-80 hover:bg-text/5 hover:text-text group-hover/tab:opacity-100',
          active ? 'opacity-100' : 'opacity-0',
        )}
      >
        <CloseRegular height={12} width={12} />
      </button>
    </motion.div>
  )

  const path = tab.path
  return (
    <ContextMenu
      items={[
        {
          label: t('common.close'),
          icon: CloseRegular,
          shortcut: active ? '⌘W' : undefined,
          onSelect: () => closeTab(tab.id),
        },
        {
          label: t('tabs.closeOthers'),
          icon: CloseSquareRegular,
          disabled: isOnly,
          onSelect: () => closeOtherTabs(tab.id),
        },
        {
          label: t('tabs.closeToRight'),
          icon: AlignArrowRightRegular,
          disabled: isLast,
          onSelect: () => closeTabsToRight(tab.id),
        },
        // The Photos library has no path in Finder.
        ...(path && !isLibraryPath(path) ? pathMenuItems(t, path) : []),
      ]}
    >
      {item}
    </ContextMenu>
  )
}

export function TabStrip() {
  const { t } = useTranslation()
  const { tabs, activeId } = useAtomValue(tabsStateAtom)
  const { newTab } = useTabs()

  const listRef = useRef<HTMLDivElement>(null)
  // Tabs open on mouse down, so a click in a gap has nothing to route to.
  const hover = useFluidHover(listRef, { axis: 'x', gapClick: false })
  const { activeIndex: hoveredIndex, itemRects, isMeasured, handlers, registerItem } = hover
  const activeIndex = tabs.findIndex((tab) => tab.id === activeId)
  const selectedRect = isMeasured ? itemRects[activeIndex] : undefined

  return (
    <div className="flex shrink items-center gap-0.5 self-stretch min-w-0">
      {/* In the sticky header, a shorter page clamping the window's scroll
       * would look to framer like the tabs moving by that much. layoutRoot
       * measures them against the strip; it needs `layout` to be measured. */}
      <motion.div
        layout
        layoutRoot
        aria-label={t('tabs.list')}
        className="relative flex min-w-0 shrink items-end gap-[3px] self-stretch"
        ref={listRef}
        role="tablist"
        onMouseEnter={handlers.onMouseEnter}
        onMouseLeave={handlers.onMouseLeave}
        onMouseMove={handlers.onMouseMove}
      >
        {selectedRect && (
          // The selected tab's sheet: the page's color, open at the bottom so it runs
          // into the page, its foot flared by two concave corners. A CSS transition,
          // not a JS spring, because a tab switch stalls JS animation on the main thread.
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-[31px] rounded-t-item bg-background transition-transform duration-240 ease-[cubic-bezier(0.4,0,0.2,1)] before:absolute before:bottom-0 before:-left-2 before:size-2 before:bg-[radial-gradient(circle_at_0_0,transparent_7.5px,var(--color-background)_8px)] before:content-[''] after:absolute after:-right-2 after:bottom-0 after:size-2 after:bg-[radial-gradient(circle_at_100%_0,transparent_7.5px,var(--color-background)_8px)] after:content-['']"
            style={{ transform: `translateX(${selectedRect.left}px)`, width: selectedRect.width }}
          />
        )}
        <FluidHoverHighlight
          className="rounded-item rounded-b-[5px]"
          hidden={hoveredIndex === activeIndex}
          hover={hover}
        />
        <AnimatePresence initial={false}>
          {tabs.map((tab, i) => (
            <TabItem
              active={tab.id === activeId}
              index={i}
              isLast={i === tabs.length - 1}
              isOnly={tabs.length === 1}
              key={tab.id}
              registerItem={registerItem}
              tab={tab}
            />
          ))}
        </AnimatePresence>
      </motion.div>
      <IconButton icon={AddRegular} label={t('tabs.newTabShortcut')} onClick={newTab} />
    </div>
  )
}
