import type { Photo } from '~/types/photo'
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider, useAtomValue } from 'jotai'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentFolderAtom,
  photosAtom,
  previewPhotoIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'

import { useDeletePhoto } from './useDeletePhoto'

const { ask, message } = vi.hoisted(() => ({
  ask: vi.fn(),
  message: vi.fn(),
}))

vi.mock('~/lib/native', () => ({ ask, message }))

const { deletePhotos, scanFolderPage, watchFolder } = vi.hoisted(() => ({
  deletePhotos: vi.fn().mockResolvedValue(undefined),
  scanFolderPage: vi.fn(),
  watchFolder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/lib/backend', () => ({ deletePhotos, scanFolderPage, watchFolder }))

function makePhoto(id: string): Photo {
  return {
    id: `/folder/${id}.jpg`,
    path: `/folder/${id}.jpg`,
    fileName: `${id}.jpg`,
    width: 100,
    height: 100,
    rating: 0,
    modified: 0,
    isCloudPlaceholder: false,
    aspectRatio: 1,
  }
}

function renderWithStore(store: ReturnType<typeof createStore>) {
  store.set(currentFolderAtom, '/folder')
  return renderHook(
    () => ({
      deletePhoto: useDeletePhoto('/folder'),
      photos: useAtomValue(photosAtom),
      selectedIds: useAtomValue(selectedPhotoIdsAtom),
      anchorId: useAtomValue(selectedPhotoIdAtom),
      previewId: useAtomValue(previewPhotoIdAtom),
    }),
    { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> },
  )
}

describe('useDeletePhoto', () => {
  beforeEach(() => {
    ask.mockReset()
    message.mockReset()
    deletePhotos.mockReset().mockResolvedValue(undefined)
    scanFolderPage.mockReset().mockResolvedValue({ photos: [], total: 0 })
  })

  it('does nothing when the confirmation dialog is declined', async () => {
    ask.mockResolvedValueOnce(false)
    const store = createStore()
    const a = makePhoto('a')
    store.set(photosAtom, [a])
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([a])
    })

    expect(deletePhotos).not.toHaveBeenCalled()
    expect(scanFolderPage).not.toHaveBeenCalled()
    expect(result.current.photos).toEqual([a])
  })

  it('deletes a single confirmed photo and removes it from the grid', async () => {
    ask.mockResolvedValueOnce(true)
    const store = createStore()
    const a = makePhoto('a')
    const b = makePhoto('b')
    store.set(photosAtom, [a, b])
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([a])
    })

    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path])
    expect(result.current.photos).toEqual([b])
  })

  it('bulk-deletes every selected photo in one call and clears them from selection', async () => {
    ask.mockResolvedValueOnce(true)
    const store = createStore()
    const a = makePhoto('a')
    const b = makePhoto('b')
    const c = makePhoto('c')
    store.set(photosAtom, [a, b, c])
    scanFolderPage.mockResolvedValueOnce({ photos: [c], total: 1 })
    store.set(selectedPhotoIdsAtom, new Set(['a', 'b', 'c']))
    store.set(selectedPhotoIdAtom, 'b')
    store.set(previewPhotoIdAtom, 'a')
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([a, b])
    })

    expect(deletePhotos).toHaveBeenCalledTimes(1)
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path, b.path])
    expect(result.current.photos).toEqual([c])
    expect(scanFolderPage).toHaveBeenCalledWith('/folder', 0, 300)
    expect(result.current.selectedIds).toEqual(new Set())
    expect(result.current.anchorId).toBeNull()
    expect(result.current.previewId).toBeNull()
  })

  it('shows an error and keeps the photo when the backend call fails', async () => {
    ask.mockResolvedValueOnce(true)
    deletePhotos.mockRejectedValueOnce(new Error('boom'))
    const store = createStore()
    const a = makePhoto('a')
    store.set(photosAtom, [a])
    scanFolderPage.mockResolvedValueOnce({ photos: [a], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([a])
    })

    expect(message).toHaveBeenCalledTimes(1)
    expect(scanFolderPage).toHaveBeenCalledTimes(1)
    expect(result.current.photos).toEqual([a])
  })

  it('refreshes actual remaining files after a partial deletion failure', async () => {
    ask.mockResolvedValueOnce(true)
    deletePhotos.mockRejectedValueOnce(new Error('Finder busy'))
    const store = createStore()
    const a = makePhoto('a')
    const b = makePhoto('b')
    store.set(photosAtom, [a, b])
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([a, b])
    })

    expect(result.current.photos).toEqual([b])
    expect(message).toHaveBeenCalledTimes(1)
  })

  it('does not navigate back when the folder changed during deletion', async () => {
    ask.mockResolvedValueOnce(true)
    const store = createStore()
    deletePhotos.mockImplementationOnce(async () => {
      store.set(currentFolderAtom, '/other')
    })
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([makePhoto('a')])
    })

    expect(scanFolderPage).not.toHaveBeenCalled()
    expect(store.get(currentFolderAtom)).toBe('/other')
  })

  it('shares the pending guard across deletion entry points until refresh finishes', async () => {
    let confirm!: (value: boolean) => void
    let finishRefresh!: (value: { photos: Photo[], total: number }) => void
    ask.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          confirm = resolve
        }),
    )
    scanFolderPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        }),
    )
    const store = createStore()
    const first = renderWithStore(store)
    const second = renderWithStore(store)
    const a = makePhoto('a')

    await act(async () => {
      const pending = first.result.current.deletePhoto([a])
      await second.result.current.deletePhoto([a])
      expect(ask).toHaveBeenCalledTimes(1)
      confirm(true)
      // Allow confirmation and the backend operation to settle.
      await Promise.resolve()
      await Promise.resolve()
      await second.result.current.deletePhoto([a])
      expect(ask).toHaveBeenCalledTimes(1)
      finishRefresh({ photos: [], total: 0 })
      await pending
    })
    expect(deletePhotos).toHaveBeenCalledTimes(1)
  })

  it('allows another attempt after cancellation', async () => {
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const { result } = renderWithStore(createStore())
    await act(async () => {
      await result.current.deletePhoto([makePhoto('a')])
      await result.current.deletePhoto([makePhoto('a')])
    })
    expect(ask).toHaveBeenCalledTimes(2)
    expect(deletePhotos).toHaveBeenCalledTimes(1)
  })

  it('is a no-op with an empty selection', async () => {
    const store = createStore()
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.deletePhoto([])
    })

    expect(ask).not.toHaveBeenCalled()
    expect(deletePhotos).not.toHaveBeenCalled()
  })
})
