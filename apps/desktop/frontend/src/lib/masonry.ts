export interface MasonryColumns {
  count: number
  width: number
}

export interface MasonryCell {
  top: number
  left: number
  height: number
  column: number
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
 *
 * `pinned[i]`, when set and in range, keeps item i in that column instead:
 * items that stay put when others leave the grid then only slide up within
 * their own column, rather than the whole grid reshuffling.
 */
export function layoutMasonry(
  aspectRatios: readonly number[],
  containerWidth: number,
  minColumnWidth: number,
  gutter: number,
  pinned: readonly (number | undefined)[] = [],
): MasonryLayout {
  const { count, width } = masonryColumns(containerWidth, minColumnWidth, gutter)
  const columnTops = Array.from<number>({ length: count }).fill(0)
  const cells = aspectRatios.map((ratio, index) => {
    let column = pinned[index] ?? -1
    if (column < 0 || column >= count) {
      column = 0
      for (let i = 1; i < count; i++) {
        if (columnTops[i] < columnTops[column])
          column = i
      }
    }
    const top = columnTops[column]
    const height = width / ratio
    columnTops[column] = top + height + gutter
    return { top, left: column * (width + gutter), height, column }
  })
  return { columnWidth: width, cells, height: Math.max(Math.max(...columnTops) - gutter, 0) }
}

export interface MasonrySection {
  /** Room above the section's items, for its header; 0 for none. */
  headerHeight: number
  aspectRatios: readonly number[]
}

export interface SectionedMasonryLayout extends MasonryLayout {
  /** Where each section's header starts. */
  headerTops: number[]
}

/**
 * Lays out each section as its own masonry (see layoutMasonry), one under
 * another, a gutter apart. The cells run on through the sections, as do
 * `pinned`'s indices.
 */
export function layoutMasonrySections(
  sections: readonly MasonrySection[],
  containerWidth: number,
  minColumnWidth: number,
  gutter: number,
  pinned: readonly (number | undefined)[] = [],
): SectionedMasonryLayout {
  const cells: MasonryCell[] = []
  const headerTops: number[] = []
  let top = 0
  for (const { headerHeight, aspectRatios } of sections) {
    const section = layoutMasonry(
      aspectRatios,
      containerWidth,
      minColumnWidth,
      gutter,
      pinned.slice(cells.length, cells.length + aspectRatios.length),
    )
    headerTops.push(top)
    const itemsTop = top + headerHeight
    for (const cell of section.cells)
      cells.push({ ...cell, top: cell.top + itemsTop })
    top = itemsTop + section.height + gutter
  }
  return {
    columnWidth: masonryColumns(containerWidth, minColumnWidth, gutter).width,
    cells,
    headerTops,
    height: Math.max(top - gutter, 0),
  }
}

/**
 * Whether `next` is `previous` with some items left out and new ones added
 * only after all the rest - the changes `pinned` columns hold up under. An
 * item in `previous` but not in `next` may come back where it was.
 */
export function onlyRemovedOrAppended(previous: readonly string[], next: readonly string[]): boolean {
  const rank = new Map(previous.map((item, i) => [item, i]))
  let last = -1
  let appending = false
  for (const item of next) {
    const r = rank.get(item)
    if (r === undefined) {
      appending = true
      continue
    }
    if (appending || r < last)
      return false
    last = r
  }
  return true
}

export type GridDirection = 'up' | 'down' | 'left' | 'right'

/**
 * How far an arrow key in `direction` travels from `origin` to `cell`, lower
 * being nearer; undefined when `cell` is not that way at all.
 */
function travel(origin: MasonryCell, cell: MasonryCell, direction: GridDirection): number | undefined {
  if (direction === 'up' || direction === 'down') {
    const distance = direction === 'up' ? origin.top - cell.top : cell.top - origin.top
    return cell.column === origin.column && distance > 0 ? distance : undefined
  }
  if (cell.column !== origin.column + (direction === 'left' ? -1 : 1))
    return undefined
  // Overlapping the origin's middle beats any distance.
  const center = origin.top + origin.height / 2
  if (cell.top <= center && center < cell.top + cell.height)
    return 0
  return Math.abs(cell.top + cell.height / 2 - center)
}

/**
 * The cell an arrow key moves to from `from`, among `candidates`: up and down
 * stay in the column, left and right go to the neighbouring column's cell
 * nearest in height. Undefined at the grid's edge.
 */
export function neighborCell(
  cells: readonly MasonryCell[],
  from: number,
  direction: GridDirection,
  candidates: readonly number[],
): number | undefined {
  const origin = cells[from]
  if (!origin)
    return undefined
  let best: number | undefined
  let bestTravel = Infinity
  for (const i of candidates) {
    const distance = i === from ? undefined : travel(origin, cells[i], direction)
    if (distance !== undefined && distance < bestTravel) {
      best = i
      bestTravel = distance
    }
  }
  return best
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
