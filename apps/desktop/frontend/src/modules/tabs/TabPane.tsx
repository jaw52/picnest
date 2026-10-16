import type { RefObject } from 'react'
import type { Tab } from '~/lib/tabs'
import * as stylex from '@stylexjs/stylex'
import { useAtomValue } from 'jotai'
import { ScopeProvider } from 'jotai-scope'
import { Activity, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currentFolderAtom, galleryTabAtoms, ratingFilterAtom } from '~/atoms/gallery'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { ScrollContainerContext } from '~/context/scroll'
import { useUndoShortcut } from '~/hooks/useDeletePhoto'
import { useOpenFolder } from '~/hooks/useOpenFolder'
import { useTabs } from '~/hooks/useTabs'
import { unwatchFolder, watchFolder } from '~/lib/backend'
import { DeleteConfirmDialog } from '~/modules/gallery/DeleteConfirmDialog'
import { FilterBar } from '~/modules/gallery/FilterBar'
import { MasonryView } from '~/modules/gallery/MasonryView'
import { PhotoInfoPopover } from '~/modules/gallery/PhotoInfo'
import { PhotoPreview } from '~/modules/gallery/PhotoPreview'
import { ThumbnailProgressBar } from '~/modules/gallery/ThumbnailProgressBar'
import { FolderControls } from '~/modules/gallery/Toolbar'
import { UndoToast } from '~/modules/gallery/UndoToast'
import { events } from '~/mygo'
import { colors } from '~/theme/colors.stylex'

import { NewTabPage } from './NewTabPage'

const styles = stylex.create({
  // Each tab scrolls on its own, under the tab bar.
  scroller: {
    position: 'absolute',
    inset: 0,
    overflowY: 'auto',
    overscrollBehavior: 'none',
    scrollbarGutter: 'stable',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: colors['--ps-background'],
  },
  main: { padding: 12 },
})

/** Where a tab's page was scrolled to, kept while it is hidden. */
interface TabScroll {
  top: number
  scroller: HTMLElement | null
}

interface TabPaneProps {
  tab: Tab
  active: boolean
  /** Where the active tab puts its folder's controls, in the tab bar. */
  controlsSlot: HTMLElement | null
}

/**
 * A tab: the folder it shows, with a gallery of its own - photos, filter,
 * selection, scroll position - that stays as it is while another tab is
 * shown, so switching back is instant. A tab not shown keeps its folder up
 * to date, but runs nothing else: no shortcuts, no thumbnail prefetching.
 */
export function TabPane({ tab, active, controlsSlot }: TabPaneProps) {
  const scrollRef = useRef<TabScroll>({ top: 0, scroller: null })
  return (
    <ScopeProvider atoms={galleryTabAtoms} name={tab.id}>
      <TabSync path={tab.path} scrollRef={scrollRef} />
      <Activity mode={active ? 'visible' : 'hidden'}>
        <TabContent path={tab.path} active={active} controlsSlot={controlsSlot} scrollRef={scrollRef} />
      </Activity>
    </ScopeProvider>
  )
}

/**
 * Keeps the tab's gallery showing its folder, shown or not: loads it as the
 * tab goes to it, watches it, and rescans it as it changes on disk.
 */
function TabSync({ path, scrollRef }: { path: string | null, scrollRef: RefObject<TabScroll> }) {
  const { navigateToFolder, refreshFolder, closeFolder } = useOpenFolder()
  const { closeFolderTabs } = useTabs()

  useEffect(() => {
    if (path === null) {
      closeFolder()
      return
    }
    void navigateToFolder(path).then((ok) => {
      if (!ok)
        closeFolderTabs(path)
    })
  }, [path, navigateToFolder, closeFolder, closeFolderTabs])

  useEffect(() => {
    if (path === null)
      return
    void watchFolder(path).catch(error => console.warn(`failed to watch folder ${path}:`, error))
    // Files added, removed or renamed outside the app show up without a
    // rescan by hand; the backend debounces bursts of changes.
    const off = events.folderChanged.on((changed) => {
      if (changed === path)
        void refreshFolder(path)
    })
    return () => {
      off()
      void unwatchFolder(path).catch(error => console.warn(`failed to stop watching ${path}:`, error))
    }
  }, [path, refreshFolder])

  // Another folder starts at its top.
  const folder = useAtomValue(currentFolderAtom)
  const shownRef = useRef(folder)
  useLayoutEffect(() => {
    if (shownRef.current === folder)
      return
    shownRef.current = folder
    scrollRef.current.top = 0
    if (scrollRef.current.scroller)
      scrollRef.current.scroller.scrollTop = 0
  }, [folder, scrollRef])
  return null
}

interface TabContentProps {
  path: string | null
  active: boolean
  controlsSlot: HTMLElement | null
  scrollRef: RefObject<TabScroll>
}

/** What a tab shows: its folder's grid, or the new-tab page. */
function TabContent({ path, active, controlsSlot, scrollRef }: TabContentProps) {
  const folder = useAtomValue(currentFolderAtom)
  const filter = useAtomValue(ratingFilterAtom)
  // The scroller as state, for the grid to measure; as a ref, to scroll.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  useUndoShortcut()

  // Hiding a tab takes its page out of the layout, which forgets how far it
  // was scrolled: put it back as the tab shows again.
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const el = scrollerRef.current
    if (!el)
      return
    scroll.scroller = el
    el.scrollTop = scroll.top
    return () => {
      scroll.scroller = null
    }
  }, [scroller, scrollRef])

  return (
    <ScrollContainerContext value={scroller}>
      <div
        ref={(el) => {
          scrollerRef.current = el
          setScroller(el)
        }}
        onScroll={(e) => {
          // Not as hiding the tab drops its page's scroll position.
          if (e.currentTarget.clientHeight > 0)
            scrollRef.current.top = e.currentTarget.scrollTop
        }}
        {...stylex.props(styles.scroller)}
      >
        {path === null
          ? <NewTabPage />
          : (
              <>
                <div data-grid-header {...stylex.props(styles.header)}>
                  <FilterBar />
                  <ThumbnailProgressBar />
                </div>
                <main {...stylex.props(styles.main)}>
                  <ErrorBoundary resetKey={`${folder}:${filter}`}>
                    <MasonryView />
                  </ErrorBoundary>
                </main>
              </>
            )}
      </div>
      <PhotoInfoPopover />
      <PhotoPreview />
      <DeleteConfirmDialog />
      <UndoToast />
      {active && controlsSlot && createPortal(<FolderControls />, controlsSlot)}
    </ScrollContainerContext>
  )
}
