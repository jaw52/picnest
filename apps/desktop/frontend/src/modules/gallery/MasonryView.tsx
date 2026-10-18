import type { GridDirection, MasonryCell, MasonrySection, SectionedMasonryLayout } from '~/lib/masonry'
import type { PhotoGroup, PhotoGrouping } from '~/lib/photo'
import type { FolderEntry } from '~/types/folder'
import type { Photo } from '~/types/photo'
import * as stylex from '@stylexjs/stylex'
import { animate } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  currentFolderAtom,
  filteredPhotosAtom,
  isScanningAtom,
  photoGroupingAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  ratingFilterAtom,
  revealPhotoAtom,
  subfoldersAtom,
  thumbnailWidthAtom,
} from '~/atoms/gallery'
import { useScrollContainer } from '~/context/scroll'
import { useBottomPull } from '~/hooks/useBottomPull'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useGridShortcuts } from '~/hooks/useGridShortcuts'
import { useOpenFolder } from '~/hooks/useOpenFolder'
import { useTabs } from '~/hooks/useTabs'
import { thumbnailCache, thumbnailCacheKey, thumbnailEdgeFor } from '~/hooks/useThumbnail'
import { useThumbnailPinch } from '~/hooks/useThumbnailPinch'
import { useThumbnailPrefetch } from '~/hooks/useThumbnailPrefetch'
import { formatPeriod } from '~/lib/format'
import { cellsInRange, layoutMasonrySections, masonryColumns, neighborCell } from '~/lib/masonry'
import { groupPhotos } from '~/lib/photo'
import { FolderTile } from '~/modules/tabs/FolderCard'
import { colors } from '~/theme/colors.stylex'
import { text, weight } from '~/theme/text'

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
/** Room above a group of photos for the period they were taken in. */
const GROUP_HEADER_HEIGHT = 36
/** How tiles move to their new places when photos come or go. */
const SLIDE = { type: 'spring' as const, duration: 0.32, bounce: 0 }

type GridInputs = readonly [
  subfolders: FolderEntry[],
  photos: Photo[],
  containerWidth: number,
  columnWidth: number,
  folderPath: string | null,
  ratingFilter: number | null,
  grouping: PhotoGrouping,
]

interface GridLayout {
  inputs: GridInputs
  layout: SectionedMasonryLayout
  /** The photos' groups, whose headers are the layout's sections' after the subfolders'. */
  groups: PhotoGroup[]
  /** The subfolders' tiles, then the photos', in the order of the layout's cells. */
  tiles: string[]
  /** What the tiles were laid out for; layouts for the same key follow on from each other. */
  key: string
  /** The layout this one took over from for the same key, which is still on screen until it renders. */
  replaced: { tiles: string[], cells: MasonryCell[] } | null
  /** Whether the tiles slide over from their places in `replaced`: only photos came or went, at the same size. */
  slide: boolean
}

/**
 * Lays out the subfolders, then the photos - each group of them under its
 * header, when grouped.
 */
function layOutGrid(inputs: GridInputs, previous: GridLayout | null): GridLayout {
  const [subfolders, photos, containerWidth, columnWidth, folderPath, ratingFilter, grouping] = inputs
  const tiles = [...subfolders.map(f => `folder:${f.path}`), ...photos.map(p => p.id)]
  const { count } = masonryColumns(containerWidth, columnWidth, COLUMN_GUTTER)
  const key = `${folderPath}|${ratingFilter}|${grouping}|${count}`
  const folderRatios = subfolders.map(() => FOLDER_TILE_ASPECT_RATIO)
  const groups = grouping === null ? [] : groupPhotos(photos, grouping)
  const sections: MasonrySection[] = grouping === null
    ? [{ headerHeight: 0, aspectRatios: [...folderRatios, ...photos.map(p => p.aspectRatio)] }]
    : [
        ...(subfolders.length > 0 ? [{ headerHeight: 0, aspectRatios: folderRatios }] : []),
        ...groups.map(g => ({ headerHeight: GROUP_HEADER_HEIGHT, aspectRatios: g.photos.map(p => p.aspectRatio) })),
      ]
  const layout = layoutMasonrySections(sections, containerWidth, columnWidth, COLUMN_GUTTER)
  const follows = previous?.key === key
  const replaced = follows ? { tiles: previous.tiles, cells: previous.layout.cells } : null
  const slide = follows && previous.inputs[2] === containerWidth && previous.inputs[3] === columnWidth
  return { inputs, layout, groups, tiles, key, replaced, slide }
}

/**
 * Slides the tiles in `container` from where `grid`'s replaced layout had
 * them to their places in `grid`, the scroller having moved `shift` since.
 */
function slideTiles(container: HTMLElement, grid: GridLayout, shift: number) {
  const { replaced } = grid
  if (!replaced || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return
  const before = new Map(replaced.tiles.map((tile, i) => [tile, replaced.cells[i]]))
  const after = new Map(grid.tiles.map((tile, i) => [tile, grid.layout.cells[i]]))
  for (const el of container.querySelectorAll<HTMLElement>('[data-tile]')) {
    const tile = el.dataset.tile ?? ''
    const from = before.get(tile)
    const to = after.get(tile)
    if (!from || !to)
      continue
    const x = from.left - to.left
    const y = from.top - to.top + shift
    if (x !== 0 || y !== 0)
      void animate(el, { x: [x, 0], y: [y, 0] }, SLIDE)
  }
}

/**
 * How far the tile at the top of the scroller (`shown` down the grid) moved
 * when `grid` took over from the layout it replaced; 0 if it didn't or left.
 */
function anchorShift(grid: GridLayout, shown: number) {
  const previous = grid.replaced
  if (!previous)
    return 0
  let anchor = -1
  for (const [i, cell] of previous.cells.entries()) {
    if (cell.top + cell.height > shown && (anchor === -1 || cell.top < previous.cells[anchor].top))
      anchor = i
  }
  const to = anchor === -1 ? -1 : grid.tiles.indexOf(previous.tiles[anchor])
  return to === -1 ? 0 : grid.layout.cells[to].top - previous.cells[anchor].top
}

/**
 * The bottom of the sticky bars over the grid, in viewport coordinates: of
 * the tab's own, in its scroller.
 */
function gridHeaderBottom(scroller: HTMLElement | null) {
  return scroller?.querySelector('[data-grid-header]')?.getBoundingClientRect().bottom ?? 0
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
  groupHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    height: GROUP_HEADER_HEIGHT - COLUMN_GUTTER,
    color: colors['--ps-foreground'],
  },
  gridHeight: (height: number) => ({ height }),
  cell: { position: 'absolute' },
  cellPosition: (top: number, left: number) => ({ top, left }),
  headerPosition: (top: number) => ({ top }),
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
  const grouping = useAtomValue(photoGroupingAtom)
  const previewId = useAtomValue(previewPhotoIdAtom)
  const { openFromClick } = useTabs()
  const { refreshFolder } = useOpenFolder()
  const deleteFolder = useDeleteFolder()
  const scroller = useScrollContainer()

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

  // Laid out again during render whenever an input changes. A photo rated
  // out of the filter or deleted reflows the grid, the tiles sliding over.
  const inputs = [subfolders, photos, containerWidth, columnWidth, folderPath, ratingFilter, grouping] as const
  const [grid, setGrid] = useState<GridLayout | null>(null)
  let current: GridLayout
  if (grid && inputs.every((input, i) => input === grid.inputs[i])) {
    current = grid
  }
  else {
    current = layOutGrid(inputs, grid)
    setGrid(current)
  }
  const { layout, groups, tiles } = current

  // Keeps the tile at the top of the scroller where it was when the grid is
  // laid out again around it, so what's on screen doesn't jump away, and
  // slides the tiles that moved. `grid` holds the layout from render by the
  // time this runs.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!grid || !el || !scroller)
      return
    // In grid coordinates; at the very top, new photos show up above.
    const shown = scroller.getBoundingClientRect().top - el.getBoundingClientRect().top
    const shift = shown > 0 ? anchorShift(grid, shown) : 0
    if (shift !== 0)
      scroller.scrollBy({ top: shift })
    if (grid.slide)
      slideTiles(el, grid, shift)
  }, [grid, scroller])

  const thumbnailEdge = thumbnailEdgeFor(layout.columnWidth)
  useThumbnailPrefetch(folderPath, containerWidth > 0 ? thumbnailEdge : 0)

  // Which part of the grid the tab's scroller shows, in grid coordinates.
  // Tracked in SCROLL_STEP increments, so scrolling re-renders a few times
  // per screen rather than every frame.
  const [viewport, setViewport] = useState({ top: 0, height: window.innerHeight })
  useEffect(() => {
    if (!scroller)
      return
    let frame = 0
    function update() {
      frame = 0
      const el = containerRef.current
      if (!el || !scroller)
        return
      const shown = scroller.getBoundingClientRect().top - el.getBoundingClientRect().top
      const top = Math.floor(shown / SCROLL_STEP) * SCROLL_STEP
      const height = scroller.clientHeight
      setViewport(prev => (prev.top === top && prev.height === height ? prev : { top, height }))
    }
    function schedule() {
      if (!frame)
        frame = requestAnimationFrame(update)
    }
    schedule()
    scroller.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(scroller)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', schedule)
      observer.disconnect()
    }
  }, [hasItems, scroller])

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
        const shownFrom = gridHeaderBottom(scroller) - (containerRef.current?.getBoundingClientRect().top ?? 0)
        const onScreen = visible
          .filter(i => i >= offset && layout.cells[i].top >= shownFrom)
          .sort((a, b) => layout.cells[a].top - layout.cells[b].top || a - b)[0]
        return photos[(onScreen ?? offset) - offset]?.id
      }
      const candidates = photos.map((_, i) => offset + i)
      const to = neighborCell(layout.cells, offset + from, direction, candidates)
      return to === undefined ? undefined : photos[to - offset].id
    },
    [subfolders, photos, layout, visible, scroller],
  )
  useGridShortcuts(neighbor)
  useThumbnailPinch(previewId === null)
  const pull = useBottomPull(previewId === null && hasItems, scroller)

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
    if (index === -1 || !el || !scroller)
      return
    // In viewport coordinates.
    const cell = layout.cells[subfolders.length + index]
    const top = el.getBoundingClientRect().top + cell.top
    const visibleTop = gridHeaderBottom(scroller) + REVEAL_MARGIN
    const visibleBottom = scroller.getBoundingClientRect().bottom - REVEAL_MARGIN
    if (top < visibleTop)
      scroller.scrollBy({ top: top - visibleTop })
    else if (top + cell.height > visibleBottom)
      scroller.scrollBy({ top: Math.min(top - visibleTop, top + cell.height - visibleBottom) })
    pendingFocusRef.current = reveal.id
    focusPending()
  }, [reveal, setReveal, photos, subfolders, layout, focusPending, scroller])
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
        {containerWidth > 0 && grouping !== null && groups.map((group, g) => {
          // The groups' sections come after the subfolders', if there are any.
          const top = layout.headerTops[g + layout.headerTops.length - groups.length]
          if (top < viewport.top - viewport.height || top > viewport.top + SCROLL_STEP + viewport.height * 2)
            return null
          return (
            <h2
              key={group.start}
              {...stylex.props(styles.groupHeader, styles.headerPosition(top), text.body, weight.semibold)}
            >
              {formatPeriod(group.start, grouping)}
            </h2>
          )
        })}
        {containerWidth > 0 && visible.map((i) => {
          const cell = layout.cells[i]
          const position = stylex.props(styles.cell, styles.cellPosition(cell.top, cell.left))
          if (i < subfolders.length) {
            const folder = subfolders[i]
            return (
              <div key={folder.path} data-tile={tiles[i]} {...position}>
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
            <div key={photo.id} data-tile={photo.id} {...position}>
              <MasonryPhotoItem data={photo} width={layout.columnWidth} folderPath={folderPath} background={background} />
            </div>
          )
        })}
      </div>
      <OverscrollArc pull={pull} />
    </>
  )
}
