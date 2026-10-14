import type { Photo } from '~/types/photo'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { TileCaption } from './TileCaption'

const photo: Photo = {
  id: '/f/a.jpg',
  path: '/f/a.jpg',
  fileName: 'a.jpg',
  width: 300,
  height: 200,
  rating: 3,
  modified: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}

it('unfolds the rating row from the rating button, and rates or clears with it', () => {
  const onRate = vi.fn()
  render(<TileCaption photo={photo} onRate={onRate} />)
  const button = screen.getByLabelText('评分')
  expect(button).toHaveTextContent('3')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.mouseEnter(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(screen.getByLabelText('5 星'))
  expect(onRate).toHaveBeenLastCalledWith(5)
  fireEvent.click(screen.getByLabelText('未评分'))
  expect(onRate).toHaveBeenLastCalledWith(0)
})
