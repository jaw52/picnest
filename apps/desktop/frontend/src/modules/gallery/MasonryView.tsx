import * as stylex from '@stylexjs/stylex'
import { useAtomValue } from 'jotai'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  currentFolderAtom,
  filteredPhotosAtom,
  isScanningAtom,
  photosTotalAtom,
  thumbnailWidthAtom,
} from '~/atoms/gallery'
import { useGridShortcuts } from '~/hooks/useGridShortcuts'
import { thumbnailEdgeFor } from '~/hooks/useThumbnail'
import { useThumbnailPrefetch } from '~/hooks/useThumbnailPrefetch'
import { cellsInRange, layoutMasonry } from '~/lib/masonry'
import { colors } from '~/theme/colors.stylex'
import { text } from '~/theme/text'

import { EmptyFolder } from './EmptyFolder'
import { MasonryPhotoItem } from './MasonryPhotoItem'

// The selection ring sits 4px outside a tile, so neighbours need more than
// 8px between them or two selected tiles' rings run together.
const COLUMN_GUTTER = 12
/** Scroll position granularity; finer steps re-render the grid for nothing. */
const SCROLL_STEP = 100

const styles = stylex.create({
  empty: {
    display: 'flex',
    minHeight: '60vh',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors['--ps-muted-foreground'],
  },
  grid: { position: 'relative' },
  gridHeight: (height: number) => ({ height }),
  cell: { position: 'absolute' },
  cellPosition: (top: number, left: number) => ({ top, left }),
})

export function MasonryView() {
  const photos = useAtomValue(filteredPhotosAtom)
  const folderPath = useAtomValue(currentFolderAtom)
  const columnWidth = useAtomValue(thumbnailWidthAtom)
  const isScanning = useAtomValue(isScanningAtom)
  const photosTotal = useAtomValue(photosTotalAtom)

  // The grid lays itself out from the photos' aspect ratios, so it only needs
  // the container's width; the window is what scrolls.
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const hasPhotos = photos.length > 0
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el)
      return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasPhotos])

  const layout = useMemo(
    () => layoutMasonry(photos.map(p => p.aspectRatio), containerWidth, columnWidth, COLUMN_GUTTER),
    [photos, containerWidth, columnWidth],
  )
  useThumbnailPrefetch(folderPath, containerWidth > 0 ? thumbnailEdgeFor(layout.columnWidth) : 0)

  // Which part of the grid the window shows, in grid coordinates. Tracked
  // in SCROLL_STEP increments, so scrolling re-renders a few times per
  // screen rather than every frame.
  const [viewport, setViewport] = useState({ top: 0, height: window.innerHeight })
  useEffect(() => {
    let frame = 0
    function update() {
      frame = 0
      const el = containerRef.current
      if (!el)
        return
      const top = Math.floor(-el.getBoundingClientRect().top / SCROLL_STEP) * SCROLL_STEP
      const height = window.innerHeight
      setViewport(prev => (prev.top === top && prev.height === height ? prev : { top, height }))
    }
    function schedule() {
      frame ||= requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [hasPhotos])

  // Mount a screen above and below the visible part, so fast scrolling with
  // 1000+ photos never shows blank gaps.
  const visible = useMemo(
    () => cellsInRange(
      layout.cells,
      viewport.top - viewport.height,
      viewport.top + SCROLL_STEP + viewport.height * 2,
    ),
    [layout, viewport],
  )

  useGridShortcuts()

  if (photos.length === 0) {
    // No folder yet means the active tab's folder is still being scanned
    // (the new-tab page replaces this view otherwise).
    if (!folderPath || isScanning)
      return null
    if (photosTotal === 0)
      return <EmptyFolder folderPath={folderPath} />
    return <div {...stylex.props(styles.empty, text.body)}>没有匹配当前筛选条件的图片</div>
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="照片"
      aria-multiselectable
      {...stylex.props(styles.grid, styles.gridHeight(layout.height))}
    >
      {containerWidth > 0 && visible.map((i) => {
        const photo = photos[i]
        const cell = layout.cells[i]
        return (
          <div key={photo.id} {...stylex.props(styles.cell, styles.cellPosition(cell.top, cell.left))}>
            <MasonryPhotoItem data={photo} width={layout.columnWidth} folderPath={folderPath} />
          </div>
        )
      })}
    </div>
  )
}
