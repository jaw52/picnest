import type { MasonryCell, MasonrySection, SectionedMasonryLayout } from '~/lib/masonry'
import type { PhotoGroup, PhotoGrouping } from '~/lib/photo'
import type { FolderEntry } from '~/types/folder'
import type { Photo } from '~/types/photo'
import { animate } from 'motion-v'
import { layoutMasonrySections, masonryColumns } from '~/lib/masonry'
import { groupPhotos } from '~/lib/photo'

/**
 * The selection ring sits 4px outside a tile, so neighbours need more than
 * 8px between them or two selected tiles' rings run together.
 */
export const COLUMN_GUTTER = 12
/** A subfolder tile's width over its height. */
const FOLDER_TILE_ASPECT_RATIO = 4 / 3
/** Room above a group of photos for the period they were taken in. */
export const GROUP_HEADER_HEIGHT = 36
/** How tiles move to their new places when photos come or go. */
const SLIDE = { type: 'spring' as const, duration: 0.32, bounce: 0 }

export interface GridInputs {
  subfolders: FolderEntry[]
  photos: Photo[]
  containerWidth: number
  columnWidth: number
  folderPath: string | null
  ratingFilter: number | null
  grouping: PhotoGrouping
}

export interface GridLayout {
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
export function layOutGrid(inputs: GridInputs, previous: GridLayout | undefined): GridLayout {
  const { subfolders, photos, containerWidth, columnWidth, folderPath, ratingFilter, grouping } = inputs
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
  const slide = follows && previous.inputs.containerWidth === containerWidth && previous.inputs.columnWidth === columnWidth
  return { inputs, layout, groups, tiles, key, replaced, slide }
}

/** Whether `grid` was laid out for exactly these inputs. */
export function sameInputs(a: GridInputs, b: GridInputs): boolean {
  return (Object.keys(a) as (keyof GridInputs)[]).every(key => a[key] === b[key])
}

/**
 * Slides the tiles in `container` from where `grid`'s replaced layout had
 * them to their places in `grid`, the scroller having moved `shift` since.
 */
export function slideTiles(container: HTMLElement, grid: GridLayout, shift: number): void {
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
export function anchorShift(grid: GridLayout, shown: number): number {
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
export function gridHeaderBottom(scroller: HTMLElement | null): number {
  return scroller?.querySelector('[data-grid-header]')?.getBoundingClientRect().bottom ?? 0
}
