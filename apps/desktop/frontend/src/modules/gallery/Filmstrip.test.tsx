import type { Photo } from '~/types/photo'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { Filmstrip } from './Filmstrip'

vi.mock('~/lib/backend', () => ({ ensureThumbnailUrl: () => new Promise(() => {}), THUMBNAIL_CANCELLED: {} }))

const photos: Photo[] = Array.from({ length: 200 }, (_, i) => ({
  id: `/f/${i}.jpg`,
  path: `/f/${i}.jpg`,
  fileName: `${i}.jpg`,
  width: 3,
  height: 2,
  rating: 0,
  modified: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}))

it('centres the current photo among the neighbours that fit, and shows one on click', () => {
  window.innerWidth = 1000
  const onSelect = vi.fn()
  render(<Filmstrip photos={photos} index={100} folderPath="/f" onSelect={onSelect} />)

  expect(screen.getByLabelText('100.jpg')).toHaveAttribute('aria-current', 'true')
  // Half the window holds 10 thumbnails a side, plus 2 mounted off screen.
  expect(screen.getAllByRole('button')).toHaveLength(25)
  expect(screen.queryByLabelText('87.jpg')).not.toBeInTheDocument()

  fireEvent.click(screen.getByLabelText('103.jpg'))
  expect(onSelect).toHaveBeenCalledWith(103)
})
