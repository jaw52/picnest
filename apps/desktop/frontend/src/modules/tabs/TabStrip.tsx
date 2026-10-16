import type { Tab } from '~/lib/tabs'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AddRegular from '~icons/mingcute/add-line'
import AlignArrowRightRegular from '~icons/mingcute/align-arrow-right-line'
import CloseRegular from '~icons/mingcute/close-line'
import CloseSquareRegular from '~icons/mingcute/close-square-line'
import CloudFilled from '~icons/mingcute/cloud-fill'
import CloudRegular from '~icons/mingcute/cloud-line'
import CopyRegular from '~icons/mingcute/copy-line'
import FolderFilled from '~icons/mingcute/folder-fill'
import FolderRegular from '~icons/mingcute/folder-line'
import FolderOpenRegular from '~icons/mingcute/folder-open-line'
import LayoutGridFilled from '~icons/mingcute/layout-grid-fill'
import LayoutGridRegular from '~icons/mingcute/layout-grid-line'
import PicFilled from '~icons/mingcute/pic-fill'
import PicRegular from '~icons/mingcute/pic-line'
import { folderNameFromPath } from '~/atoms/recentFolders'
import { tabsStateAtom } from '~/atoms/tabs'
import { ContextMenu } from '~/components/ContextMenu'
import { FluidHoverHighlight } from '~/components/FluidHoverHighlight'
import { IconButton } from '~/components/IconButton'
import { useFluidHover } from '~/hooks/use-fluid-hover'
import { useIsICloudFolder } from '~/hooks/useIsICloudFolder'
import { useTabs } from '~/hooks/useTabs'
import { isLibraryPath } from '~/lib/library'
import { openPath, writeText } from '~/lib/native'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { control, radius } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'
import { tabMarker } from './markers.stylex'

/**
 * How far a hovered tab keeps from the bar's bottom edge and from the active
 * tab beside it.
 */
const TAB_INSET = 3

const styles = stylex.create({
  strip: {
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 2,
    minWidth: 0,
    flexShrink: 1,
  },
  tabs: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    gap: TAB_INSET,
    minWidth: 0,
    flexShrink: 1,
  },
  tab: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    // Tabs share the row evenly and shrink together, like a browser's.
    width: 180,
    minWidth: 72,
    flexShrink: 1,
    height: control.heightCompact,
    // Centered on the active tab, which reaches down to the page.
    marginBottom: TAB_INSET,
    paddingLeft: 10,
    paddingRight: 4,
    cursor: 'default',
    color: colors['--ps-muted-foreground'],
    transitionProperty: 'color',
    transitionDuration: '80ms',
  },
  active: { color: colors['--ps-foreground'] },
  // Slides between tabs as the hover does.
  hover: {
    borderRadius: radius.item,
    // Concentric with the selection's flared corners, so a hovered
    // neighbour's edge runs parallel to them, TAB_INSET away.
    borderBottomLeftRadius: `calc(${radius.item} - ${TAB_INSET}px)`,
    borderBottomRightRadius: `calc(${radius.item} - ${TAB_INSET}px)`,
  },
  // The selected tab's sheet, sliding between tabs: in the page's color and
  // open at the bottom, so it runs into the page, its foot flared out by two
  // concave corners. Level with the tabs at the top, it reaches TAB_INSET
  // further down, to the page.
  selection: {
    'position': 'absolute',
    'left': 0,
    'bottom': 0,
    'pointerEvents': 'none',
    'height': `calc(${control.heightCompact} + ${TAB_INSET}px)`,
    'borderTopLeftRadius': radius.item,
    'borderTopRightRadius': radius.item,
    'backgroundColor': colors['--ps-background'],
    // A CSS transition, not a JS spring: a tab switch renders the new grid
    // on the main thread, stalling JS animation, while WebKit runs this on
    // the compositor. Only with a cubic Bézier (linear() falls back); this
    // one starts from rest and settles like spring.moderate.
    'transitionProperty': 'transform',
    'transitionDuration': '240ms',
    'transitionTimingFunction': 'cubic-bezier(0.4, 0, 0.2, 1)',
    '::before': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      left: `calc(-1 * ${radius.item})`,
      width: radius.item,
      height: radius.item,
      backgroundImage: `radial-gradient(circle at 0 0, transparent calc(${radius.item} - 0.5px), ${colors['--ps-background']} ${radius.item})`,
    },
    '::after': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      right: `calc(-1 * ${radius.item})`,
      width: radius.item,
      height: radius.item,
      backgroundImage: `radial-gradient(circle at 100% 0, transparent calc(${radius.item} - 0.5px), ${colors['--ps-background']} ${radius.item})`,
    },
  },
  icon: { flexShrink: 0 },
  iconSpace: { width: 14, height: 14 },
  label: { minWidth: 0, flexGrow: 1, flexBasis: 0 },
  close: {
    display: 'flex',
    width: 20,
    height: 20,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderWidth: 0,
    borderRadius: 6,
    cursor: 'pointer',
    // Only the active tab and the hovered one offer their close button.
    opacity: {
      default: 0,
      [stylex.when.ancestor(':hover', tabMarker)]: 1,
    },
    backgroundColor: { 'default': 'transparent', ':hover': colors['--ps-hover'] },
    color: {
      'default': colors['--ps-muted-foreground'],
      ':hover': colors['--ps-foreground'],
    },
    transitionProperty: 'opacity, color, background-color',
    transitionDuration: '80ms',
  },
  closeVisible: { opacity: 1 },
  selectionAt: (left: number, width: number) => ({ transform: `translateX(${left}px)`, width }),
})

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

function TabIcon({ path, active }: { path: string | null, active: boolean }) {
  const iCloud = useIsICloudFolder(path)
  const library = isLibraryPath(path)
  if (path !== null && !library && iCloud === undefined)
    return <span {...stylex.props(styles.icon, styles.iconSpace)} />
  const kind = path === null ? 'newTab' : library ? 'library' : iCloud ? 'iCloud' : 'local'
  const Icon = TAB_ICONS[kind][active ? 1 : 0]
  return <Icon width={14} height={14} {...stylex.props(styles.icon)} />
}

interface TabItemProps {
  tab: Tab
  index: number
  active: boolean
  isOnly: boolean
  isLast: boolean
  registerItem: (index: number, element: HTMLElement | null) => void
}

function TabItem({ tab, index, active, isOnly, isLast, registerItem }: TabItemProps) {
  const { t } = useTranslation()
  const { activateTab, closeTab, closeOtherTabs, closeTabsToRight } = useTabs()
  const title = tab.path === null
    ? t('common.newTab')
    : isLibraryPath(tab.path) ? t('library.name') : folderNameFromPath(tab.path)

  // A closed tab leaves its slot as it starts fading out, in the same commit
  // the tabs after it move down a slot, so it never clears its successor's.
  const ref = useRef<HTMLDivElement>(null)
  const isPresent = useIsPresent()
  useEffect(() => {
    if (!isPresent)
      return
    registerItem(index, ref.current)
    return () => registerItem(index, null)
  }, [index, isPresent, registerItem])

  const item = (
    <motion.div
      ref={ref}
      layout="position"
      role="tab"
      data-fluid-hover-index={index}
      aria-selected={active}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: spring.moderate.exit }}
      transition={spring.moderate}
      {...stylex.props(tabMarker, styles.tab, active && styles.active, text.caption)}
      onMouseDown={(e) => {
        // Middle click closes, like a browser.
        if (e.button === 1) {
          e.preventDefault()
          closeTab(tab.id)
        }
        else if (e.button === 0) {
          activateTab(tab.id)
        }
      }}
    >
      <TabIcon path={tab.path} active={active} />
      <span
        {...stylex.props(styles.label, utility.truncate, active ? weight.semibold : weight.normal)}
      >
        {title}
      </span>
      <button
        type="button"
        aria-label={t('tabs.closeTab', { title })}
        {...stylex.props(styles.close, active && styles.closeVisible)}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => closeTab(tab.id)}
      >
        <CloseRegular width={12} height={12} />
      </button>
    </motion.div>
  )

  const path = tab.path
  return (
    <ContextMenu
      items={[
        { label: t('common.close'), icon: CloseRegular, shortcut: active ? '⌘W' : undefined, onSelect: () => closeTab(tab.id) },
        { label: t('tabs.closeOthers'), icon: CloseSquareRegular, disabled: isOnly, onSelect: () => closeOtherTabs(tab.id) },
        { label: t('tabs.closeToRight'), icon: AlignArrowRightRegular, disabled: isLast, onSelect: () => closeTabsToRight(tab.id) },
        // The Photos library has no path in Finder.
        ...(path && !isLibraryPath(path)
          ? [
              { label: t('common.copyPath'), icon: CopyRegular, onSelect: () => void writeText(path) },
              {
                label: t('common.revealInFinder'),
                icon: FolderOpenRegular,
                onSelect: () =>
                  void openPath(path).catch(error => console.warn(`failed to open ${path}:`, error)),
              },
            ]
          : []),
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
  const activeIndex = tabs.findIndex(tab => tab.id === activeId)
  const selectedRect = isMeasured ? itemRects[activeIndex] : undefined

  return (
    <div {...stylex.props(styles.strip)}>
      {/* In the sticky header, a shorter page clamping the window's scroll
       * would look to framer like the tabs moving by that much. layoutRoot
       * measures them against the strip; it needs `layout` to be measured. */}
      <motion.div
        ref={listRef}
        layout
        layoutRoot
        role="tablist"
        aria-label={t('tabs.list')}
        onMouseMove={handlers.onMouseMove}
        onMouseEnter={handlers.onMouseEnter}
        onMouseLeave={handlers.onMouseLeave}
        {...stylex.props(styles.tabs)}
      >
        {selectedRect && (
          <div {...stylex.props(styles.selection, styles.selectionAt(selectedRect.left, selectedRect.width))} />
        )}
        <FluidHoverHighlight hover={hover} hidden={hoveredIndex === activeIndex} xstyle={styles.hover} />
        <AnimatePresence initial={false}>
          {tabs.map((tab, i) => (
            <TabItem
              key={tab.id}
              tab={tab}
              index={i}
              active={tab.id === activeId}
              registerItem={registerItem}
              isOnly={tabs.length === 1}
              isLast={i === tabs.length - 1}
            />
          ))}
        </AnimatePresence>
      </motion.div>
      <IconButton label={t('tabs.newTabShortcut')} icon={AddRegular} onClick={newTab} />
    </div>
  )
}
