import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import type { Photo } from '~/types/photo'

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
  taken: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}))

it('mounts the thumbnails in view around the current photo, and shows one on click', () => {
  window.innerWidth = 1000
  const onSelect = vi.fn()
  render(<Filmstrip folderPath="/f" index={100} photos={photos} onSelect={onSelect} />)

  expect(screen.getByLabelText('100.jpg')).toHaveAttribute('aria-current', 'true')
  // Thumbnails 91-109 show in the 1000px strip, with a few more mounted past each edge.
  expect(screen.getByLabelText('87.jpg')).toBeInTheDocument()
  expect(screen.getByLabelText('114.jpg')).toBeInTheDocument()
  expect(screen.queryByLabelText('86.jpg')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('115.jpg')).not.toBeInTheDocument()

  fireEvent.click(screen.getByLabelText('103.jpg'))
  expect(onSelect).toHaveBeenCalledWith(103)
})

it('scrolls on its own, without changing the photo or reaching the lightbox', () => {
  window.innerWidth = 1000
  const onSelect = vi.fn()
  const onLightboxWheel = vi.fn()
  render(
    <div onWheel={onLightboxWheel}>
      <Filmstrip folderPath="/f" index={100} photos={photos} onSelect={onSelect} />
    </div>,
  )
  const strip = screen.getByLabelText('100.jpg').closest('div')!.parentElement!

  fireEvent.wheel(strip, { deltaX: 300 })
  expect(onLightboxWheel).not.toHaveBeenCalled()

  strip.scrollLeft = 150 * 54
  fireEvent.scroll(strip)
  expect(screen.getByLabelText('150.jpg')).toBeInTheDocument()
  expect(screen.queryByLabelText('100.jpg')).not.toBeInTheDocument()
  expect(onSelect).not.toHaveBeenCalled()
})
