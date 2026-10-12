import { describe, expect, it } from 'vitest'

import { cellsInRange, layoutMasonry, masonryColumns } from './masonry'

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
      { top: 0, left: 0, height: 100 },
      { top: 0, left: 108, height: 200 },
      { top: 108, left: 0, height: 50 },
      { top: 166, left: 0, height: 100 },
    ])
    expect(layout.height).toBe(266)
  })

  it('is empty for no items', () => {
    expect(layoutMasonry([], 500, 100, 8)).toEqual({ columnWidth: 119, cells: [], height: 0 })
  })
})

describe('cellsInRange', () => {
  it('returns the cells overlapping the band', () => {
    const cells = [
      { top: 0, left: 0, height: 100 },
      { top: 108, left: 0, height: 100 },
      { top: 216, left: 0, height: 100 },
    ]
    expect(cellsInRange(cells, 150, 220)).toEqual([1, 2])
    expect(cellsInRange(cells, 400, 500)).toEqual([])
  })
})
