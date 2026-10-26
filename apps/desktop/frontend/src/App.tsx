import { useAtomValue } from 'jotai'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { tabsStateAtom } from '~/atoms/tabs'
import { useSettingsEvents } from '~/hooks/useSettingsEvents'
import { useFolderDrop, useTabShortcuts } from '~/hooks/useTabShortcuts'
import { spring } from '~/lib/springs'
import type { Tab } from '~/lib/tabs'
import { Toolbar } from '~/modules/gallery/Toolbar'
import { SettingsDialog } from '~/modules/settings/SettingsDialog'
import { TabPane } from '~/modules/tabs/TabPane'

/**
 * How many tabs keep their gallery while others are shown: the ones used
 * last. Each holds its photos' list and decoded thumbnails; one left out
 * loads its folder again when it is switched back to.
 */
const KEPT_TABS = 5

/**
 * The tabs that keep their gallery: the active one and those used last
 * before it, up to KEPT_TABS, in the tabs' order.
 */
function useKeptTabs(tabs: Tab[], activeId: string) {
  const [used, setUsed] = useState<string[]>([activeId])
  // Kept in step during render, so a tab switched to mounts at once.
  if (used[0] !== activeId) setUsed([activeId, ...used.filter((id) => id !== activeId)])
  const open = new Set(tabs.map((t) => t.id))
  const kept = new Set([activeId, ...used.filter((id) => open.has(id))].slice(0, KEPT_TABS))
  return tabs.filter((t) => kept.has(t.id))
}

export default function App() {
  const { t } = useTranslation()
  useSettingsEvents()
  useTabShortcuts()
  const isDraggingOver = useFolderDrop()
  const { tabs, activeId } = useAtomValue(tabsStateAtom)
  const kept = useKeptTabs(tabs, activeId)
  const [controlsSlot, setControlsSlot] = useState<HTMLDivElement | null>(null)

  return (
    <div className="flex h-screen flex-col bg-background text-text">
      {/* The tab bar doubles as a drag handle, like a native app's title
       * bar - clicking a tab or button still works, only click+drag on
       * empty space moves the window. Toolbar marks itself with
       * data-drag-region (see styles/app.css). */}
      <Toolbar controlsRef={setControlsSlot} />
      {/* The tabs' pages, each scrolling on its own (see TabPane). */}
      <div className="relative min-h-0 grow">
        {kept.map((tab) => (
          <TabPane active={tab.id === activeId} controlsSlot={controlsSlot} key={tab.id} tab={tab} />
        ))}
      </div>
      <SettingsDialog />
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            animate={{ opacity: 1 }}
            className="wght-semibold pointer-events-none fixed inset-2 z-100 flex items-center justify-center rounded-container border-2 border-dashed border-accent bg-accent/10 text-body text-text"
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            initial={{ opacity: 0 }}
            transition={spring.moderate}
          >
            {t('app.dropToAddFolder')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
