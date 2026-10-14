import type { RefObject } from 'react'
import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentFolderAtom, ratingFilterAtom } from '~/atoms/gallery'
import { activeTabPathAtom } from '~/atoms/tabs'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { useSize } from '~/context/size'
import { useUndoShortcut } from '~/hooks/useDeletePhoto'
import { useFolderWatcher } from '~/hooks/useFolderWatcher'
import { useOpenFolder } from '~/hooks/useOpenFolder'
import { useSettingsEvents } from '~/hooks/useSettingsEvents'
import { useActiveTabSync } from '~/hooks/useTabs'
import { useFolderDrop, useTabShortcuts } from '~/hooks/useTabShortcuts'
import { spring } from '~/lib/springs'
import { DeleteConfirmDialog } from '~/modules/gallery/DeleteConfirmDialog'
import { FilterBar } from '~/modules/gallery/FilterBar'
import { MasonryView } from '~/modules/gallery/MasonryView'
import { PhotoInfoPopover } from '~/modules/gallery/PhotoInfo'
import { PhotoPreview } from '~/modules/gallery/PhotoPreview'
import { ThumbnailProgressBar } from '~/modules/gallery/ThumbnailProgressBar'
import { Toolbar } from '~/modules/gallery/Toolbar'
import { UndoToast } from '~/modules/gallery/UndoToast'
import { SettingsDialog } from '~/modules/settings/SettingsDialog'
import { NewTabPage } from '~/modules/tabs/NewTabPage'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { weight } from '~/theme/text'

// The window has no native title bar (macOS "Overlay" style: just the
// traffic lights float over our content, in the window's top-left corner).
// Toolbar - the tab bar - reserves space to their right.
const TITLEBAR_HEIGHT = 38

/** An element's height, kept up to date as it changes. */
function useHeight(ref: RefObject<HTMLElement | null>, initial: number) {
  const [height, setHeight] = useState(initial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el)
      return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return height
}

const styles = stylex.create({
  root: {
    minHeight: '100vh',
    backgroundColor: colors['--ps-background'],
    color: colors['--ps-foreground'],
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: colors['--ps-background'],
  },
  // The filter bar sticks just below the tab bar.
  stickAt: (top: number) => ({ top }),
  main: { padding: 12 },
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

export default function App() {
  const { t } = useTranslation()
  useActiveTabSync()
  useSettingsEvents()
  useTabShortcuts()
  useUndoShortcut()
  const isDraggingOver = useFolderDrop()
  const tabPath = useAtomValue(activeTabPathAtom)
  const folder = useAtomValue(currentFolderAtom)
  const filter = useAtomValue(ratingFilterAtom)
  const size = useSize()
  const { refreshFolder } = useOpenFolder()
  useFolderWatcher(() => {
    if (folder)
      void refreshFolder(folder)
  })

  // FilterBar sticks just below the tab bar, whose height is measured.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolbarHeight = useHeight(toolbarRef, TITLEBAR_HEIGHT)

  return (
    <div {...stylex.props(styles.root)}>
      <div ref={toolbarRef} {...stylex.props(styles.header)}>
        {/* The tab bar doubles as a drag handle, like a native app's
         * title bar - clicking a tab or button still works, only
         * click+drag on empty space moves the window. Toolbar marks itself
         * with data-drag-region (see theme/theme.css). */}
        <Toolbar />
      </div>
      <div data-grid-header {...stylex.props(styles.header, styles.stickAt(toolbarHeight))}>
        {tabPath !== null && <FilterBar />}
        <ThumbnailProgressBar />
      </div>
      {tabPath === null
        ? <NewTabPage />
        : (
            <main {...stylex.props(styles.main)}>
              <ErrorBoundary resetKey={`${folder}:${filter}`}>
                <MasonryView />
              </ErrorBoundary>
            </main>
          )}
      <PhotoInfoPopover />
      <PhotoPreview />
      <DeleteConfirmDialog />
      <UndoToast />
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
