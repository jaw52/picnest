import type { GridDirection, MasonryLayout } from '~/lib/masonry'
import type { FolderEntry } from '~/types/folder'
import type { Photo } from '~/types/photo'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  currentFolderAtom,
  filteredPhotosAtom,
  isScanningAtom,
  pendingScrollAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  ratingFilterAtom,
  revealPhotoAtom,
  subfoldersAtom,
  thumbnailWidthAtom,
} from '~/atoms/gallery'
import { useBottomPull } from '~/hooks/useBottomPull'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useGridShortcuts } from '~/hooks/useGridShortcuts'
import { useOpenFolder } from '~/hooks/useOpenFolder'
import { useTabs } from '~/hooks/useTabs'
import { thumbnailCache, thumbnailCacheKey, thumbnailEdgeFor } from '~/hooks/useThumbnail'
import { useThumbnailPinch } from '~/hooks/useThumbnailPinch'
import { useThumbnailPrefetch } from '~/hooks/useThumbnailPrefetch'
import { cellsInRange, layoutMasonry, masonryColumns, neighborCell } from '~/lib/masonry'
import { FolderTile } from '~/modules/tabs/FolderCard'
import { colors } from '~/theme/colors.stylex'
import { text } from '~/theme/text'

import { MasonryPhotoItem } from './MasonryPhotoItem'
import { OverscrollArc } from './OverscrollArc'

// The selection ring sits 4px outside a tile, so neighbours need more than
// 8px between them or two selected tiles' rings run together.
const COLUMN_GUTTER = 12
/** Scroll position granularity; finer steps re-render the grid for nothing. */
const SCROLL_STEP = 100
/** A subfolder tile's width over its height. */
const FOLDER_TILE_ASPECT_RATIO = 4 / 3
/** Room kept between a revealed photo and the edges of the visible grid. */
const REVEAL_MARGIN = 12

type GridInputs = readonly [
  subfolders: FolderEntry[],
  photos: Photo[],
  containerWidth: number,
  columnWidth: number,
  folderPath: string | null,
  ratingFilter: number | null,
]

interface GridLayout {
  inputs: GridInputs
  layout: MasonryLayout
  /** What the tiles' columns were laid out for; a change of it starts afresh. */
  key: string
  columnByTile: Map<string, number>
}

/** Lays out the subfolders, then the photos, keeping tiles in the columns `previous` gave them. */
function layOutGrid(inputs: GridInputs, previous: GridLayout | null): GridLayout {
  const [subfolders, photos, containerWidth, columnWidth, folderPath, ratingFilter] = inputs
  const tiles = [...subfolders.map(f => `folder:${f.path}`), ...photos.map(p => p.id)]
  const { count } = masonryColumns(containerWidth, columnWidth, COLUMN_GUTTER)
  const key = `${folderPath}|${ratingFilter}|${count}`
  const kept = previous?.key === key ? previous.columnByTile : new Map<string, number>()
  const layout = layoutMasonry(
    [...subfolders.map(() => FOLDER_TILE_ASPECT_RATIO), ...photos.map(p => p.aspectRatio)],
    containerWidth,
    columnWidth,
    COLUMN_GUTTER,
    tiles.map(tile => kept.get(tile)),
  )
  // Tiles that left keep their column too, so an undone delete (or a rating
  // undone) puts the photo back where it was.
  const columnByTile = new Map(kept)
  tiles.forEach((tile, i) => columnByTile.set(tile, layout.cells[i].column))
  return { inputs, layout, key, columnByTile }
}

/** The bottom of the sticky bars over the grid, in viewport coordinates. */
function gridHeaderBottom() {
  return document.querySelector('[data-grid-header]')?.getBoundingClientRect().bottom ?? 0
}

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

/**
 * The open folder's subfolders, then its photos, in one masonry. A subfolder
 * opens in place, like a link; the rating filter only narrows the photos.
 */
export function MasonryView() {
  const { t } = useTranslation()
  const photos = useAtomValue(filteredPhotosAtom)
  const subfolders = useAtomValue(subfoldersAtom)
  const folderPath = useAtomValue(currentFolderAtom)
  const columnWidth = useAtomValue(thumbnailWidthAtom)
  const isScanning = useAtomValue(isScanningAtom)
  const photosTotal = useAtomValue(photosTotalAtom)
  const ratingFilter = useAtomValue(ratingFilterAtom)
  const previewId = useAtomValue(previewPhotoIdAtom)
  const { openFromClick } = useTabs()
  const { refreshFolder } = useOpenFolder()
  const deleteFolder = useDeleteFolder()

  // The grid lays itself out from the photos' aspect ratios, so it only needs
  // the container's width; the window is what scrolls.
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const hasItems = subfolders.length + photos.length > 0
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el)
      return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasItems])

  // Laid out again during render whenever an input changes, keeping each
  // tile in its column (see layOutGrid): a photo rated out of the filter or
  // deleted only closes up its own column, not the whole grid.
  const inputs = [subfolders, photos, containerWidth, columnWidth, folderPath, ratingFilter] as const
  const [grid, setGrid] = useState<GridLayout | null>(null)
  let layout: MasonryLayout
  if (grid && inputs.every((input, i) => input === grid.inputs[i])) {
    layout = grid.layout
  }
  else {
    const next = layOutGrid(inputs, grid)
    setGrid(next)
    layout = next.layout
  }
  const thumbnailEdge = thumbnailEdgeFor(layout.columnWidth)
  useThumbnailPrefetch(folderPath, containerWidth > 0 ? thumbnailEdge : 0)

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
  }, [hasItems])

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

  // Arrow keys: from a photo to its neighbour, or from no selection to the
  // first photo on screen.
  const neighbor = useCallback(
    (id: string | null, direction: GridDirection) => {
      const offset = subfolders.length
      const from = id === null ? -1 : photos.findIndex(p => p.id === id)
      if (from === -1) {
        // In grid coordinates, the first line not hidden under the bars.
        const shownFrom = gridHeaderBottom() - (containerRef.current?.getBoundingClientRect().top ?? 0)
        const onScreen = visible
          .filter(i => i >= offset && layout.cells[i].top >= shownFrom)
          .sort((a, b) => layout.cells[a].top - layout.cells[b].top || a - b)[0]
        return photos[(onScreen ?? offset) - offset]?.id
      }
      const candidates = photos.map((_, i) => offset + i)
      const to = neighborCell(layout.cells, offset + from, direction, candidates)
      return to === undefined ? undefined : photos[to - offset].id
    },
    [subfolders, photos, layout, visible],
  )
  useGridShortcuts(neighbor)
  useThumbnailPinch(previewId === null)
  const pull = useBottomPull(previewId === null && hasItems)

  // Brings a photo into view - scrolling only as far as needed - and moves
  // focus to it once its tile is mounted (it may be off in the virtualized
  // part of the grid until the scroll lands).
  const [reveal, setReveal] = useAtom(revealPhotoAtom)
  const pendingFocusRef = useRef<string | null>(null)
  const focusPending = useCallback(() => {
    const id = pendingFocusRef.current
    const tile = id === null
      ? null
      : containerRef.current?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(id)}"]`)
    if (tile) {
      tile.focus({ preventScroll: true })
      pendingFocusRef.current = null
    }
  }, [])
  useEffect(() => {
    if (!reveal)
      return
    setReveal(null)
    const index = photos.findIndex(p => p.id === reveal.id)
    const el = containerRef.current
    if (index === -1 || !el)
      return
    const cell = layout.cells[subfolders.length + index]
    const top = el.getBoundingClientRect().top + window.scrollY + cell.top
    const visibleTop = window.scrollY + gridHeaderBottom() + REVEAL_MARGIN
    const visibleBottom = window.scrollY + window.innerHeight - REVEAL_MARGIN
    if (top < visibleTop)
      window.scrollTo({ top: window.scrollY - (visibleTop - top) })
    else if (top + cell.height > visibleBottom)
      window.scrollTo({ top: window.scrollY + Math.min(top - visibleTop, top + cell.height - visibleBottom) })
    pendingFocusRef.current = reveal.id
    focusPending()
  }, [reveal, setReveal, photos, subfolders, layout, focusPending])
  // A tab switched back to scrolls to where it was left, once the grid has
  // its height.
  const [pendingScroll, setPendingScroll] = useAtom(pendingScrollAtom)
  useLayoutEffect(() => {
    if (pendingScroll === null || containerWidth === 0)
      return
    window.scrollTo(0, pendingScroll)
    setPendingScroll(null)
  }, [pendingScroll, containerWidth, setPendingScroll])
  // A tile scrolled to from afar mounts once the grid catches up with the scroll.
  useLayoutEffect(() => {
    focusPending()
  }, [visible, focusPending])

  if (!hasItems) {
    // No folder yet means the active tab's folder is still being scanned
    // (the new-tab page replaces this view otherwise).
    if (!folderPath || isScanning)
      return null
    return (
      <div {...stylex.props(styles.empty, text.body)}>
        {photosTotal === 0 ? t('gallery.emptyFolder') : t('gallery.noMatches')}
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        role="listbox"
        aria-label={t('gallery.photos')}
        aria-multiselectable
        {...stylex.props(styles.grid, styles.gridHeight(layout.height))}
      >
        {containerWidth > 0 && visible.map((i) => {
          const cell = layout.cells[i]
          const position = stylex.props(styles.cell, styles.cellPosition(cell.top, cell.left))
          if (i < subfolders.length) {
            const folder = subfolders[i]
            return (
              <div key={folder.path} {...position}>
                <FolderTile
                  path={folder.path}
                  name={folder.name}
                  width={layout.columnWidth}
                  height={cell.height}
                  onOpen={e => openFromClick(folder.path, e)}
                  onDelete={() => void deleteFolder(folder.path).then(() => {
                    if (folderPath)
                      void refreshFolder(folderPath)
                  })}
                />
              </div>
            )
          }
          const photo = photos[i - subfolders.length]
          // The window's top is somewhere in the SCROLL_STEP below viewport.top.
          const onScreen = cell.top < viewport.top + SCROLL_STEP + viewport.height
            && cell.top + cell.height > viewport.top
          // A tile off screen asks for its thumbnail behind those on screen.
          // One that has its thumbnail keeps the flag as it is, so scrolling
          // past doesn't render it again.
          const background = !onScreen
            && !thumbnailCache.has(thumbnailCacheKey(folderPath, photo.path, thumbnailEdge, photo.isCloudPlaceholder))
          return (
            <div key={photo.id} {...position}>
              <MasonryPhotoItem data={photo} width={layout.columnWidth} folderPath={folderPath} background={background} />
            </div>
          )
        })}
      </div>
      <OverscrollArc pull={pull} />
    </>
  )
}
