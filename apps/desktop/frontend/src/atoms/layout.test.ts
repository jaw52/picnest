import { expect, it } from 'vitest'
import { MAIN_MIN_WIDTH, panelMaxWidth } from './layout'

const info = { min: 220, max: 480 }

it('lets a panel reach its own maximum when the window has room', () => {
  expect(panelMaxWidth(info, 1600)).toBe(480)
})

it('holds back a panel so the grid keeps its minimum width', () => {
  expect(panelMaxWidth(info, 700)).toBe(700 - MAIN_MIN_WIDTH)
})

it('never goes below the panel\'s own minimum, even on a tiny window', () => {
  expect(panelMaxWidth(info, 400)).toBe(220)
})
