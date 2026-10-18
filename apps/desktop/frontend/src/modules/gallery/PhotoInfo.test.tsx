import type { Photo } from '~/types/photo'
import { act, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { expect, it, vi } from 'vitest'

import { currentFolderAtom, photoInfoIdAtom, photosAtom } from '~/atoms/gallery'

import { PhotoInfoPopover } from './PhotoInfo'

vi.mock('~/lib/backend', () => ({ getPhotoDetails: () => new Promise(() => {}) }))
vi.mock('~/lib/native', () => ({ writeText: vi.fn() }))

const photo: Photo = {
  id: '/f/a.jpg',
  path: '/f/a.jpg',
  fileName: 'a.jpg',
  width: 300,
  height: 200,
  rating: 0,
  modified: 0,
  taken: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}

it('shows a photo\'s info beside its tile, and closes once the photo is gone', async () => {
  const store = createStore()
  store.set(currentFolderAtom, '/f')
  store.set(photosAtom, [photo])
  render(
    <Provider store={store}>
      <div data-photo-id={photo.id} />
      <PhotoInfoPopover />
    </Provider>,
  )

  act(() => store.set(photoInfoIdAtom, photo.id))
  expect(await screen.findByText('300 × 200')).toBeInTheDocument()
  expect(screen.getByText('a.jpg')).toBeInTheDocument()

  act(() => store.set(photosAtom, []))
  expect(screen.queryByText('300 × 200')).not.toBeInTheDocument()
  expect(store.get(photoInfoIdAtom)).toBe(null)
})
