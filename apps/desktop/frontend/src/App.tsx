import type { Tab } from '~/lib/tabs'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tabsStateAtom } from '~/atoms/tabs'
import { useSize } from '~/context/size'
import { useSettingsEvents } from '~/hooks/useSettingsEvents'
import { useFolderDrop, useTabShortcuts } from '~/hooks/useTabShortcuts'
import { spring } from '~/lib/springs'
import { Toolbar } from '~/modules/gallery/Toolbar'
import { SettingsDialog } from '~/modules/settings/SettingsDialog'
import { TabPane } from '~/modules/tabs/TabPane'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { weight } from '~/theme/text'

/**
 * How many tabs keep their gallery while others are shown: the ones used
 * last. Each holds its photos' list and decoded thumbnails; one left out
 * loads its folder again when it is switched back to.
 */
const KEPT_TABS = 5

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: colors['--ps-background'],
    color: colors['--ps-foreground'],
  },
  // The tabs' pages, each scrolling on its own (see TabPane).
  pages: { position: 'relative', flexGrow: 1, minHeight: 0 },
  dropOverlay: {
    pointerEvents: 'none',
    position: 'fixed',
    inset: 8,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors['--ps-focus-ring'],
    borderRadius: radius.container,
    backgroundColor: `color-mix(in srgb, ${colors['--ps-focus-ring']} 10%, transparent)`,
    color: colors['--ps-foreground'],
  },
})

/**
 * The tabs that keep their gallery: the active one and those used last
 * before it, up to KEPT_TABS, in the tabs' order.
 */
function useKeptTabs(tabs: Tab[], activeId: string) {
  const [used, setUsed] = useState<string[]>([activeId])
  // Kept in step during render, so a tab switched to mounts at once.
  if (used[0] !== activeId)
    setUsed([activeId, ...used.filter(id => id !== activeId)])
  const open = new Set(tabs.map(t => t.id))
  const kept = new Set([activeId, ...used.filter(id => open.has(id))].slice(0, KEPT_TABS))
  return tabs.filter(t => kept.has(t.id))
}

export default function App() {
  const { t } = useTranslation()
  useSettingsEvents()
  useTabShortcuts()
  const isDraggingOver = useFolderDrop()
  const size = useSize()
  const { tabs, activeId } = useAtomValue(tabsStateAtom)
  const kept = useKeptTabs(tabs, activeId)
  const [controlsSlot, setControlsSlot] = useState<HTMLDivElement | null>(null)

  return (
    <div {...stylex.props(styles.root)}>
      {/* The tab bar doubles as a drag handle, like a native app's title
       * bar - clicking a tab or button still works, only click+drag on
       * empty space moves the window. Toolbar marks itself with
       * data-drag-region (see theme/theme.css). */}
      <Toolbar controlsRef={setControlsSlot} />
      <div {...stylex.props(styles.pages)}>
        {kept.map(tab => (
          <TabPane key={tab.id} tab={tab} active={tab.id === activeId} controlsSlot={controlsSlot} />
        ))}
      </div>
      <SettingsDialog />
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            {...stylex.props(styles.dropOverlay, size.text, weight.semibold)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            transition={spring.moderate}
          >
            {t('app.dropToAddFolder')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
