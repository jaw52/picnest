import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useLayoutEffect, useRef, useState } from 'react'
import { currentFolderAtom, ratingFilterAtom } from '~/atoms/gallery'
import { activeTabPathAtom } from '~/atoms/tabs'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { useSize } from '~/context/size'
import { useFolderWatcher } from '~/hooks/useFolderWatcher'
import { useInfoPanelExtent } from '~/hooks/useInfoPanelExtent'
import { useOpenFolder } from '~/hooks/useOpenFolder'
import { useActiveTabSync } from '~/hooks/useTabs'
import { useFolderDrop, useTabShortcuts } from '~/hooks/useTabShortcuts'
import { spring } from '~/lib/springs'
import { FilterBar } from '~/modules/gallery/FilterBar'
import { InfoPanel } from '~/modules/gallery/InfoPanel'
import { MasonryView } from '~/modules/gallery/MasonryView'
import { PhotoPreview } from '~/modules/gallery/PhotoPreview'
import { ThumbnailProgressBar } from '~/modules/gallery/ThumbnailProgressBar'
import { Toolbar } from '~/modules/gallery/Toolbar'
import { NewTabPage } from '~/modules/tabs/NewTabPage'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { weight } from '~/theme/text'

// The window has no native title bar (macOS "Overlay" style: just the
// traffic lights float over our content, in the window's top-left corner).
// Toolbar - the tab bar - reserves space to their right.
const TITLEBAR_HEIGHT = 38

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
  useActiveTabSync()
  useTabShortcuts()
  const isDraggingOver = useFolderDrop()
  const tabPath = useAtomValue(activeTabPathAtom)
  const folder = useAtomValue(currentFolderAtom)
  const filter = useAtomValue(ratingFilterAtom)
  const infoExtent = useInfoPanelExtent(tabPath === null)
  const size = useSize()
  const { refreshFolder } = useOpenFolder()
  useFolderWatcher(() => {
    if (folder)
      void refreshFolder(folder)
  })

  // The info sidebar's content should start level with the main column's
  // content (below Toolbar + FilterBar + the progress bar), not just below
  // the traffic lights - that header's height isn't fixed (the progress bar
  // only renders while scanning), so measure it rather than hardcoding it.
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(TITLEBAR_HEIGHT)
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el)
      return
    const observer = new ResizeObserver(([entry]) => setHeaderHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div {...stylex.props(styles.root)}>
      {tabPath !== null && <InfoPanel extent={infoExtent} paddingTop={headerHeight} />}
      <motion.div style={{ marginRight: infoExtent }}>
        <div ref={headerRef} {...stylex.props(styles.header)}>
          {/* The tab bar doubles as a drag handle, like a native app's
           * title bar - clicking a tab or button still works, only
           * click+drag on empty space moves the window. Toolbar marks itself
           * with data-drag-region (see theme/theme.css). */}
          <Toolbar />
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
      </motion.div>
      <PhotoPreview />
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            {...stylex.props(styles.dropOverlay, size.text, weight.semibold)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            transition={spring.moderate}
          >
            松开以添加并打开文件夹
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
