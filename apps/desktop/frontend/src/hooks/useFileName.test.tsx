import type { Photo } from '~/types/photo'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { useFileName } from './useFileName'

const { libraryFileNames } = vi.hoisted(() => ({ libraryFileNames: vi.fn() }))
vi.mock('~/lib/backend', () => ({ libraryFileNames }))

function photo(path: string, fileName = ''): Photo {
  return {
    id: path,
    path,
    fileName,
    width: 4,
    height: 3,
    rating: 0,
    modified: 0,
    isCloudPlaceholder: false,
    aspectRatio: 4 / 3,
  }
}

function Name({ photo }: { photo: Photo }) {
  return <span data-testid={photo.path}>{useFileName(photo)}</span>
}

beforeEach(() => {
  libraryFileNames.mockReset()
})

it('reads the names of the library photos shown together, once', async () => {
  libraryFileNames.mockImplementation(async (paths: string[]) =>
    Object.fromEntries(paths.map(p => [p, `${p.slice('photos:'.length)}.HEIC`])))
  const photos = [photo('photos:a'), photo('photos:b'), photo('/f/c.jpg', 'c.jpg')]
  const { rerender } = render(<>{photos.map(p => <Name key={p.path} photo={p} />)}</>)

  expect(screen.getByTestId('/f/c.jpg').textContent).toBe('c.jpg')
  await waitFor(() => expect(screen.getByTestId('photos:b').textContent).toBe('b.HEIC'))
  expect(screen.getByTestId('photos:a').textContent).toBe('a.HEIC')
  expect(libraryFileNames).toHaveBeenCalledTimes(1)
  expect(libraryFileNames).toHaveBeenCalledWith(['photos:a', 'photos:b'])

  // Shown again, they come from what was read.
  rerender(<>{photos.slice(0, 1).map(p => <Name key={p.path} photo={p} />)}</>)
  expect(screen.getByTestId('photos:a').textContent).toBe('a.HEIC')
  expect(libraryFileNames).toHaveBeenCalledTimes(1)
})

it('asks again for names it failed to read', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  libraryFileNames.mockRejectedValueOnce('no access').mockResolvedValueOnce({ 'photos:z': 'z.JPG' })
  const { unmount } = render(<Name photo={photo('photos:z')} />)
  await waitFor(() => expect(libraryFileNames).toHaveBeenCalledTimes(1))
  unmount()

  render(<Name photo={photo('photos:z')} />)
  await waitFor(() => expect(screen.getByTestId('photos:z').textContent).toBe('z.JPG'))
  expect(libraryFileNames).toHaveBeenCalledTimes(2)
})
