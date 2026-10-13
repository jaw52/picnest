import type { RefObject } from 'react'
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
import { DeleteConfirmDialog } from '~/modules/gallery/DeleteConfirmDialog'
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

  // The tab bar spans the window and the info panel hangs below it. The
  // panel's content starts level with the grid, below FilterBar and the
  // progress bar - whose height isn't fixed (the progress bar only renders
  // while thumbnails generate, the filter bar can wrap), so both are measured.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolbarHeight = useHeight(toolbarRef, TITLEBAR_HEIGHT)
  const subheaderRef = useRef<HTMLDivElement>(null)
  const subheaderHeight = useHeight(subheaderRef, 0)

  return (
    <div {...stylex.props(styles.root)}>
      <div ref={toolbarRef} {...stylex.props(styles.header)}>
        {/* The tab bar doubles as a drag handle, like a native app's
         * title bar - clicking a tab or button still works, only
         * click+drag on empty space moves the window. Toolbar marks itself
         * with data-drag-region (see theme/theme.css). */}
        <Toolbar />
      </div>
      {tabPath !== null && <InfoPanel extent={infoExtent} top={toolbarHeight} paddingTop={subheaderHeight} />}
      <motion.div style={{ marginRight: infoExtent }}>
        <div ref={subheaderRef} {...stylex.props(styles.header, styles.stickAt(toolbarHeight))}>
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
      <DeleteConfirmDialog />
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            {...stylex.props(styles.dropOverlay, size.text, weight.semibold)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            transition={spring.moderate}
          >
            松开以添加文件夹
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
