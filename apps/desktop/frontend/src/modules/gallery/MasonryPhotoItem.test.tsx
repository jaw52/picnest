import type { Photo } from '~/types/photo'
import { act, render, screen } from '@testing-library/react'
import { createStore, Provider, useAtomValue } from 'jotai'
import { expect, it, vi } from 'vitest'

import { photosAtom, selectedPhotoIdAtom, selectedPhotoIdsAtom, setPhotoRatingAtom } from '~/atoms/gallery'

// A tile calls useFileName on every render, so its calls count the tile's renders.
const renders = vi.hoisted(() => new Map<string, number>())
vi.mock('~/hooks/useFileName', () => ({
  useFileName: (photo: Photo) => {
    renders.set(photo.id, (renders.get(photo.id) ?? 0) + 1)
    return photo.fileName
  },
}))

vi.mock('~/lib/backend', async importOriginal => ({
  ...await importOriginal<object>(),
  ensureThumbnailUrl: () => new Promise(() => {}),
}))

const { MasonryPhotoItem } = await import('./MasonryPhotoItem')

const photos: Photo[] = Array.from({ length: 30 }, (_, i) => ({
  id: `/f/${i}.jpg`,
  path: `/f/${i}.jpg`,
  fileName: `${i}.jpg`,
  width: 300,
  height: 200,
  rating: 0,
  modified: 0,
  taken: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}))

function setup() {
  const store = createStore()
  store.set(photosAtom, photos)
  // Like the grid: re-renders with the photos, each tile fed its photo.
  function Grid() {
    return useAtomValue(photosAtom).map(p => (
      <MasonryPhotoItem key={p.id} data={p} width={240} folderPath="/f" background={false} />
    ))
  }
  render(<Provider store={store}><Grid /></Provider>)
  renders.clear()
  return { store }
}

it('selecting a photo re-renders only the tiles whose selection changed', () => {
  const { store } = setup()
  const select = (id: string) => act(() => {
    store.set(selectedPhotoIdsAtom, new Set([id]))
    store.set(selectedPhotoIdAtom, id)
  })

  select(photos[3].id)
  expect(screen.getByLabelText('3.jpg')).toHaveAttribute('aria-selected', 'true')
  expect(renders.size).toBeLessThanOrEqual(2)

  renders.clear()
  select(photos[9].id)
  expect(screen.getByLabelText('3.jpg')).toHaveAttribute('aria-selected', 'false')
  expect(screen.getByLabelText('9.jpg')).toHaveAttribute('aria-selected', 'true')
  expect(renders.size).toBeLessThanOrEqual(2)
})

it('rating a photo re-renders only that tile', () => {
  const { store } = setup()

  act(() => store.set(setPhotoRatingAtom, [photos[5].id], 4))

  expect(screen.getByLabelText('5.jpg')).toHaveTextContent('4★')
  expect([...renders.keys()]).toEqual([photos[5].id])
})
