import { describe, expect, it } from 'vitest'

import { cellsInRange, layoutMasonry, layoutMasonrySections, masonryColumns, neighborCell, onlyRemovedOrAppended } from './masonry'

describe('masonryColumns', () => {
  it('fits as many minimum-width columns as possible and stretches them', () => {
    expect(masonryColumns(1000, 240, 8)).toEqual({ count: 4, width: 244 })
  })

  it('keeps one column when the container is narrower than a column', () => {
    expect(masonryColumns(100, 240, 8)).toEqual({ count: 1, width: 100 })
  })
})

describe('layoutMasonry', () => {
  it('places each item in the shortest column, leftmost on ties', () => {
    // 2 columns of 100px with an 8px gutter.
    const layout = layoutMasonry([1, 0.5, 2, 1], 208, 100, 8)
    expect(layout.columnWidth).toBe(100)
    expect(layout.cells).toEqual([
      { top: 0, left: 0, height: 100, column: 0 },
      { top: 0, left: 108, height: 200, column: 1 },
      { top: 108, left: 0, height: 50, column: 0 },
      { top: 166, left: 0, height: 100, column: 0 },
    ])
    expect(layout.height).toBe(266)
  })

  it('keeps pinned items in their column, placing the rest as usual', () => {
    const layout = layoutMasonry([1, 1, 1], 208, 100, 8, [1, undefined, 1])
    expect(layout.cells.map(c => c.column)).toEqual([1, 0, 1])
    expect(layout.cells[2].top).toBe(108)
  })

  it('ignores a pinned column that no longer exists', () => {
    const layout = layoutMasonry([1], 208, 100, 8, [5])
    expect(layout.cells[0].column).toBe(0)
  })

  it('is empty for no items', () => {
    expect(layoutMasonry([], 500, 100, 8)).toEqual({ columnWidth: 119, cells: [], height: 0 })
  })
})

describe('layoutMasonrySections', () => {
  it('stacks each section under its header, a gutter apart', () => {
    const layout = layoutMasonrySections(
      [{ headerHeight: 0, aspectRatios: [1, 0.5] }, { headerHeight: 30, aspectRatios: [1] }],
      208,
      100,
      8,
    )
    expect(layout.headerTops).toEqual([0, 208])
    expect(layout.cells).toEqual([
      { top: 0, left: 0, height: 100, column: 0 },
      { top: 0, left: 108, height: 200, column: 1 },
      { top: 238, left: 0, height: 100, column: 0 },
    ])
    expect(layout.height).toBe(338)
  })

  it('pins by index across sections', () => {
    const layout = layoutMasonrySections(
      [{ headerHeight: 0, aspectRatios: [1] }, { headerHeight: 0, aspectRatios: [1] }],
      208,
      100,
      8,
      [undefined, 1],
    )
    expect(layout.cells.map(c => c.column)).toEqual([0, 1])
  })
})

describe('onlyRemovedOrAppended', () => {
  it('holds for items left out, put back where they were, or added at the end', () => {
    expect(onlyRemovedOrAppended(['a', 'b', 'c'], ['a', 'c'])).toBe(true)
    expect(onlyRemovedOrAppended(['a', 'b', 'c'], ['a', 'b', 'c', 'd'])).toBe(true)
    expect(onlyRemovedOrAppended(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toBe(true)
  })

  it('fails for items added among the others or moved', () => {
    expect(onlyRemovedOrAppended(['a', 'b'], ['a', 'x', 'b'])).toBe(false)
    expect(onlyRemovedOrAppended(['a', 'b'], ['x', 'a', 'b'])).toBe(false)
    expect(onlyRemovedOrAppended(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})

describe('neighborCell', () => {
  // Column 0: cells 0 (0-100), 2 (108-158), 3 (166-266); column 1: cell 1 (0-200).
  const { cells } = layoutMasonry([1, 0.5, 2, 1], 208, 100, 8)
  const all = [0, 1, 2, 3]

  it('moves up and down within the column', () => {
    expect(neighborCell(cells, 2, 'down', all)).toBe(3)
    expect(neighborCell(cells, 2, 'up', all)).toBe(0)
    expect(neighborCell(cells, 0, 'up', all)).toBeUndefined()
  })

  it('moves sideways to the cell nearest in height', () => {
    expect(neighborCell(cells, 3, 'right', all)).toBe(1)
    expect(neighborCell(cells, 1, 'left', all)).toBe(2)
    expect(neighborCell(cells, 1, 'right', all)).toBeUndefined()
  })

  it('only lands on candidates', () => {
    expect(neighborCell(cells, 2, 'up', [1, 2, 3])).toBeUndefined()
  })
})

describe('cellsInRange', () => {
  it('returns the cells overlapping the band', () => {
    const cells = [
      { top: 0, left: 0, height: 100, column: 0 },
      { top: 108, left: 0, height: 100, column: 0 },
      { top: 216, left: 0, height: 100, column: 0 },
    ]
    expect(cellsInRange(cells, 150, 220)).toEqual([1, 2])
    expect(cellsInRange(cells, 400, 500)).toEqual([])
  })
})
