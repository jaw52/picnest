// Same algorithm as apps/desktop/frontend/src/lib/masonry.ts, so the cost
// of laying out is the app's own.

export interface MasonryCell {
  top: number
  left: number
  height: number
}

export interface MasonryLayout {
  columnWidth: number
  cells: MasonryCell[]
  height: number
}

export const GUTTER = 12
/** Scroll position granularity; finer steps re-render the grid for nothing. */
export const SCROLL_STEP = 100

export function layoutMasonry(aspectRatios: readonly number[], containerWidth: number, minColumnWidth: number): MasonryLayout {
  const count = Math.max(Math.floor((containerWidth + GUTTER) / (minColumnWidth + GUTTER)), 1)
  const width = Math.floor((containerWidth - GUTTER * (count - 1)) / count)
  const columnTops = Array.from<number>({ length: count }).fill(0)
  const cells = aspectRatios.map((ratio) => {
    let column = 0
    for (let i = 1; i < count; i++) {
      if (columnTops[i] < columnTops[column])
        column = i
    }
    const top = columnTops[column]
    const height = width / ratio
    columnTops[column] = top + height + GUTTER
    return { top, left: column * (width + GUTTER), height }
  })
  return { columnWidth: width, cells, height: Math.max(Math.max(...columnTops) - GUTTER, 0) }
}

/**
 * Indices of the cells to mount for a scroller showing [top, top + height]:
 * a screen above and below too, so fast scrolling never shows gaps.
 */
export function visibleCells(cells: readonly MasonryCell[], top: number, height: number): number[] {
  const from = top - height
  const to = top + SCROLL_STEP + height * 2
  const indices: number[] = []
  cells.forEach((cell, i) => {
    if (cell.top <= to && cell.top + cell.height >= from)
      indices.push(i)
  })
  return indices
}

/** The scroller's position snapped to SCROLL_STEP. */
export function snapScroll(scrollTop: number) {
  return Math.floor(scrollTop / SCROLL_STEP) * SCROLL_STEP
}

/** A thumbnail in the preview's filmstrip, in CSS px, with the gap after it. */
export const FILM_STEP = 54
/** Filmstrip thumbnails mounted past each edge of the strip. */
export const FILM_OVERSCAN = 4

/** Indices of the filmstrip thumbnails to mount for a strip `width` wide scrolled to `scrollLeft`. */
export function filmRange(count: number, scrollLeft: number, width: number): [number, number] {
  const pad = width / 2
  const first = Math.max(Math.floor((scrollLeft - pad) / FILM_STEP) - FILM_OVERSCAN, 0)
  const last = Math.min(Math.ceil((scrollLeft - pad + width) / FILM_STEP) + FILM_OVERSCAN, count - 1)
  return [first, last]
}
