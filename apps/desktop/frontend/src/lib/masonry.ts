export interface MasonryColumns {
  count: number
  width: number
}

export interface MasonryCell {
  top: number
  left: number
  height: number
}

export interface MasonryLayout {
  columnWidth: number
  cells: MasonryCell[]
  /** Total height of the grid, without a trailing gutter. */
  height: number
}

/**
 * As many columns of at least `minColumnWidth` as fit, stretched to fill
 * `containerWidth` (always at least one).
 */
export function masonryColumns(containerWidth: number, minColumnWidth: number, gutter: number): MasonryColumns {
  const count = Math.max(Math.floor((containerWidth + gutter) / (minColumnWidth + gutter)), 1)
  const width = Math.floor((containerWidth - gutter * (count - 1)) / count)
  return { count, width }
}

/**
 * Places each item, in order, at the bottom of the currently shortest column
 * (leftmost on ties). Heights come from aspect ratios, so no measuring is
 * needed and the result depends only on the inputs.
 */
export function layoutMasonry(
  aspectRatios: readonly number[],
  containerWidth: number,
  minColumnWidth: number,
  gutter: number,
): MasonryLayout {
  const { count, width } = masonryColumns(containerWidth, minColumnWidth, gutter)
  const columnTops = Array.from<number>({ length: count }).fill(0)
  const cells = aspectRatios.map((ratio) => {
    let column = 0
    for (let i = 1; i < count; i++) {
      if (columnTops[i] < columnTops[column])
        column = i
    }
    const top = columnTops[column]
    const height = width / ratio
    columnTops[column] = top + height + gutter
    return { top, left: column * (width + gutter), height }
  })
  return { columnWidth: width, cells, height: Math.max(Math.max(...columnTops) - gutter, 0) }
}

/** Indices of the cells overlapping the vertical band [top, bottom]. */
export function cellsInRange(cells: readonly MasonryCell[], top: number, bottom: number): number[] {
  const indices: number[] = []
  cells.forEach((cell, i) => {
    if (cell.top <= bottom && cell.top + cell.height >= top)
      indices.push(i)
  })
  return indices
}
