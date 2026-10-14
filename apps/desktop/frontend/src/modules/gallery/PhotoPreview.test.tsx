import type { Photo } from '~/types/photo'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'

import { beforeEach, expect, it, vi } from 'vitest'
import {
  currentFolderAtom,
  photosAtom,
  previewPhotoIdAtom,
  selectedPhotoIdsAtom,
  subfoldersAtom,
} from '~/atoms/gallery'

import { MasonryView } from './MasonryView'
import { PhotoPreview } from './PhotoPreview'

const { deletePhoto } = vi.hoisted(() => ({ deletePhoto: vi.fn() }))
vi.mock('~/hooks/useDeletePhoto', () => ({ useDeletePhoto: () => deletePhoto }))
const { rate } = vi.hoisted(() => ({ rate: vi.fn() }))
vi.mock('~/hooks/useRatePhoto', () => ({ useRatePhoto: () => rate }))
vi.mock('./MasonryPhotoItem', () => ({ MasonryPhotoItem: () => null }))
vi.mock('~/lib/native', () => ({ convertFileSrc: (path: string) => path, writeText: vi.fn() }))
vi.mock('~/lib/backend', () => ({}))
vi.mock('~/modules/tabs/FolderCard', () => ({
  FolderTile: ({ name }: { name: string }) => <span>{name}</span>,
}))

beforeEach(() => {
  deletePhoto.mockClear()
  rate.mockClear()
})

it.each(['Delete', 'Backspace'])(
  'routes %s only to the preview, then restores grid shortcuts on close',
  (key) => {
    const store = createStore()
    const a: Photo = {
      id: '/a.jpg',
      path: '/a.jpg',
      fileName: 'a.jpg',
      width: 100,
      height: 100,
      rating: 0,
      modified: 0,
      isCloudPlaceholder: false,
      aspectRatio: 1,
    }
    const b: Photo = { ...a, id: '/b.jpg', path: '/b.jpg', fileName: 'b.jpg' }
    store.set(currentFolderAtom, '/')
    store.set(photosAtom, [a, b])
    store.set(selectedPhotoIdsAtom, new Set([a.id, b.id]))
    store.set(previewPhotoIdAtom, b.id)
    render(
      <Provider store={store}>
        <MasonryView />
        <PhotoPreview />
      </Provider>,
    )

    fireEvent.keyDown(window, { key })
    expect(deletePhoto).toHaveBeenCalledTimes(1)
    expect(deletePhoto).toHaveBeenLastCalledWith([b])
    fireEvent.keyDown(window, { key, repeat: true })
    expect(deletePhoto).toHaveBeenCalledTimes(1)

    act(() => store.set(previewPhotoIdAtom, null))
    fireEvent.keyDown(window, { key })
    expect(deletePhoto).toHaveBeenCalledTimes(2)
    expect(deletePhoto).toHaveBeenLastCalledWith([a, b])
  },
)

it('rates the grid selection, then only the previewed photo, with the 0-5 keys', () => {
  const store = createStore()
  const a: Photo = {
    id: '/a.jpg',
    path: '/a.jpg',
    fileName: 'a.jpg',
    width: 100,
    height: 100,
    rating: 0,
    modified: 0,
    isCloudPlaceholder: false,
    aspectRatio: 1,
  }
  const b: Photo = { ...a, id: '/b.jpg', path: '/b.jpg', fileName: 'b.jpg' }
  store.set(currentFolderAtom, '/')
  store.set(photosAtom, [a, b])
  store.set(selectedPhotoIdsAtom, new Set([a.id, b.id]))
  render(
    <Provider store={store}>
      <MasonryView />
      <PhotoPreview />
    </Provider>,
  )

  fireEvent.keyDown(window, { key: '4' })
  expect(rate.mock.calls).toEqual([[[a, b], 4]])

  rate.mockClear()
  fireEvent.keyDown(window, { key: '4', metaKey: true })
  expect(rate).not.toHaveBeenCalled()

  act(() => store.set(previewPhotoIdAtom, b.id))
  fireEvent.keyDown(window, { key: '5' })
  expect(rate.mock.calls).toEqual([[[b], 5]])
})

it('stays blank until a folder loads, then notes an empty folder', async () => {
  const store = createStore()
  const { rerender } = render(
    <Provider store={store}>
      <MasonryView />
    </Provider>,
  )
  expect(document.body.textContent).toBe('')

  act(() => store.set(currentFolderAtom, '/empty'))
  rerender(
    <Provider store={store}>
      <MasonryView />
    </Provider>,
  )
  expect(await screen.findByText('这个文件夹是空的')).toBeInTheDocument()
})

it('lays out a folder that only holds other folders instead of calling it empty', () => {
  const store = createStore()
  store.set(currentFolderAtom, '/parent')
  store.set(subfoldersAtom, [{ name: '星云', path: '/parent/星云' }])
  render(
    <Provider store={store}>
      <MasonryView />
    </Provider>,
  )
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  expect(document.body.textContent).not.toContain('这个文件夹是空的')
})

function twoPhotos() {
  const a: Photo = {
    id: '/a.jpg',
    path: '/a.jpg',
    fileName: 'a.jpg',
    width: 100,
    height: 100,
    rating: 0,
    modified: 0,
    isCloudPlaceholder: false,
    aspectRatio: 1,
  }
  return [a, { ...a, id: '/b.jpg', path: '/b.jpg', fileName: 'b.jpg' }] as const
}

it('previews the selection on Space and closes the preview on Space, like Quick Look', () => {
  const store = createStore()
  const [a, b] = twoPhotos()
  store.set(currentFolderAtom, '/')
  store.set(photosAtom, [a, b])
  store.set(selectedPhotoIdsAtom, new Set([b.id]))
  render(
    <Provider store={store}>
      <MasonryView />
      <PhotoPreview />
    </Provider>,
  )

  fireEvent.keyDown(window, { key: ' ' })
  expect(store.get(previewPhotoIdAtom)).toBe(b.id)

  fireEvent.keyDown(window, { key: ' ' })
  expect(store.get(previewPhotoIdAtom)).toBeNull()
})

it('leaves Space alone with nothing selected, on buttons, or with a modifier', () => {
  const store = createStore()
  const [a, b] = twoPhotos()
  store.set(currentFolderAtom, '/')
  store.set(photosAtom, [a, b])
  render(
    <Provider store={store}>
      <MasonryView />
      <button type="button">star</button>
    </Provider>,
  )

  fireEvent.keyDown(window, { key: ' ' })
  expect(store.get(previewPhotoIdAtom)).toBeNull()

  act(() => store.set(selectedPhotoIdsAtom, new Set([a.id])))
  fireEvent.keyDown(screen.getByText('star'), { key: ' ' })
  expect(store.get(previewPhotoIdAtom)).toBeNull()
  fireEvent.keyDown(window, { key: ' ', metaKey: true })
  expect(store.get(previewPhotoIdAtom)).toBeNull()
})

it('moves the selection with the arrow keys, extending it with Shift', () => {
  const store = createStore()
  const [a, b] = twoPhotos()
  const c: Photo = { ...a, id: '/c.jpg', path: '/c.jpg', fileName: 'c.jpg' }
  store.set(currentFolderAtom, '/')
  store.set(photosAtom, [a, b, c])
  render(
    <Provider store={store}>
      <MasonryView />
    </Provider>,
  )

  // Nothing selected yet: the first photo.
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set([a.id]))
  // One column here (the test DOM has no width), so down is the next photo.
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set([b.id]))
  fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true })
  expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set([b.id, c.id]))
  fireEvent.keyDown(window, { key: 'ArrowUp' })
  expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set([b.id]))
})
