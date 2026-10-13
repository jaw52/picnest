import type { Tab } from '~/lib/tabs'
import { FolderFilled, LayoutGridFilled } from '@mingcute/react/core-filled'
import { AddRegular, AlignArrowRightRegular, CloseRegular, CloseSquareRegular, CopyRegular, FolderOpenRegular, FolderRegular, LayoutGridRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { folderNameFromPath } from '~/atoms/recentFolders'
import { tabsStateAtom } from '~/atoms/tabs'
import { ContextMenu } from '~/components/ContextMenu'
import { IconButton } from '~/components/IconButton'
import { useTabs } from '~/hooks/useTabs'
import { openPath, writeText } from '~/lib/native'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { control, radius } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'
import { tabMarker } from './markers.stylex'

const NEW_TAB_TITLE = '新标签页'

const styles = stylex.create({
  strip: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
    flexShrink: 1,
  },
  tabs: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
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
    paddingLeft: 8,
    paddingRight: 4,
    cursor: 'default',
    borderRadius: radius.item,
    color: colors['--ps-muted-foreground'],
    backgroundColor: { 'default': 'transparent', ':hover': colors['--ps-hover'] },
    transitionProperty: 'color, background-color',
    transitionDuration: '80ms',
  },
  active: {
    color: colors['--ps-foreground'],
    backgroundColor: { 'default': colors['--ps-active'], ':hover': colors['--ps-active'] },
  },
  icon: { flexShrink: 0 },
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
})

function TabItem({ tab, active, isOnly, isLast }: { tab: Tab, active: boolean, isOnly: boolean, isLast: boolean }) {
  const { activateTab, closeTab, closeOtherTabs, closeTabsToRight } = useTabs()
  const title = tab.path ? folderNameFromPath(tab.path) : NEW_TAB_TITLE
  const Icon = tab.path
    ? (active ? FolderFilled : FolderRegular)
    : (active ? LayoutGridFilled : LayoutGridRegular)

  const item = (
    <motion.div
      layout="position"
      role="tab"
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
      <Icon size={14} {...stylex.props(styles.icon)} />
      <span
        {...stylex.props(styles.label, utility.truncate, active ? weight.semibold : weight.normal)}
      >
        {title}
      </span>
      <button
        type="button"
        aria-label={`关闭 ${title}`}
        {...stylex.props(styles.close, active && styles.closeVisible)}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => closeTab(tab.id)}
      >
        <CloseRegular size={12} />
      </button>
    </motion.div>
  )

  const path = tab.path
  return (
    <ContextMenu
      items={[
        { label: '关闭', icon: CloseRegular, shortcut: active ? '⌘W' : undefined, onSelect: () => closeTab(tab.id) },
        { label: '关闭其他标签页', icon: CloseSquareRegular, disabled: isOnly, onSelect: () => closeOtherTabs(tab.id) },
        { label: '关闭右侧标签页', icon: AlignArrowRightRegular, disabled: isLast, onSelect: () => closeTabsToRight(tab.id) },
        ...(path
          ? [
              { label: '复制路径', icon: CopyRegular, onSelect: () => void writeText(path) },
              {
                label: '在访达中打开',
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
  const { tabs, activeId } = useAtomValue(tabsStateAtom)
  const { newTab } = useTabs()

  return (
    <div {...stylex.props(styles.strip)}>
      {/* In the sticky header, a shorter page clamping the window's scroll
       * would look to framer like the tabs moving by that much. layoutRoot
       * measures them against the strip; it needs `layout` to be measured. */}
      <motion.div layout layoutRoot role="tablist" aria-label="文件夹标签页" {...stylex.props(styles.tabs)}>
        <AnimatePresence initial={false}>
          {tabs.map((tab, i) => (
            <TabItem
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              isOnly={tabs.length === 1}
              isLast={i === tabs.length - 1}
            />
          ))}
        </AnimatePresence>
      </motion.div>
      <IconButton label="新标签页 (⌘T)" icon={AddRegular} onClick={newTab} />
    </div>
  )
}
