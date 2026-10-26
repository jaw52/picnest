import { act, renderHook } from '@testing-library/react'
import { createStore, Provider, useAtomValue } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  currentFolderAtom,
  deleteConfirmRequestAtom,
  photosAtom,
  previewPhotoIdAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
  thumbnailProgressAtom,
  undoableDeletionAtom,
} from '~/atoms/gallery'
import type { Photo } from '~/types/photo'

import { useDeletePhoto, useUndoDeletion } from './useDeletePhoto'

const { ask, message } = vi.hoisted(() => ({
  ask: vi.fn(),
  message: vi.fn(),
}))

vi.mock('~/lib/native', () => ({ ask, message }))

const { deletePhotos, restorePhotos, scanFolderPage, watchFolder } = vi.hoisted(() => ({
  deletePhotos: vi.fn(),
  restorePhotos: vi.fn(),
  scanFolderPage: vi.fn(),
  watchFolder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/lib/backend', () => ({
  deletePhotos,
  restorePhotos,
  scanFolderPage,
  watchFolder,
  listSubfolders: vi.fn().mockResolvedValue([]),
}))

/** The backend trashing every photo it is given. */
async function trashAll(_folder: string, paths: string[]) {
  return { trashed: paths.map((path) => ({ path, trashPath: `/.Trash${path}`, rating: 0 })), deleted: [], failures: [] }
}

function makePhoto(id: string): Photo {
  return {
    id: `/folder/${id}.jpg`,
    path: `/folder/${id}.jpg`,
    fileName: `${id}.jpg`,
    width: 100,
    height: 100,
    rating: 0,
    modified: 0,
    taken: 0,
    isCloudPlaceholder: false,
    aspectRatio: 1,
  }
}

/** A photo in the Photos library, its path the asset's identifier. */
function libraryPhoto(id: string): Photo {
  return { ...makePhoto(id), id: `photos:${id}`, path: `photos:${id}` }
}

/** Answers the bulk-delete dialog once the hook has opened it. */
async function answerDialog(store: ReturnType<typeof createStore>, keep: (photos: Photo[]) => Photo[] | null) {
  await Promise.resolve()
  const request = store.get(deleteConfirmRequestAtom)
  expect(request).not.toBeNull()
  request!.resolve(keep(request!.photos))
  store.set(deleteConfirmRequestAtom, null)
}

/** Deletes `photos`, confirming them in the dialog. */
async function deleteConfirmed(
  store: ReturnType<typeof createStore>,
  deletePhoto: (photos: Photo[]) => Promise<void>,
  photos: Photo[],
) {
  const pending = deletePhoto(photos)
  await answerDialog(store, (kept) => kept)
  await pending
}

function renderWithStore(store: ReturnType<typeof createStore>, folder = '/folder') {
  store.set(currentFolderAtom, folder)
  return renderHook(
    () => ({
      deletePhoto: useDeletePhoto(folder),
      undo: useUndoDeletion(),
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
    deletePhotos.mockReset().mockImplementation(trashAll)
    restorePhotos.mockReset().mockResolvedValue(undefined)
    scanFolderPage.mockReset().mockResolvedValue({ photos: [], total: 0 })
  })

  it('confirms a single photo in the same dialog and removes it from the grid', async () => {
    const store = createStore()
    const a = makePhoto('a')
    const b = makePhoto('b')
    store.set(photosAtom, [a, b])
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [a])
    })

    expect(ask).not.toHaveBeenCalled()
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path])
    expect(result.current.photos).toEqual([b])
  })

  it('selects the photo after a deleted one, ready for the next delete', async () => {
    const store = createStore()
    const [a, b, c] = ['a', 'b', 'c'].map((id) => makePhoto(id))
    store.set(photosAtom, [a, b, c])
    store.set(selectedPhotoIdsAtom, new Set([b.id]))
    store.set(selectedPhotoIdAtom, b.id)
    scanFolderPage.mockResolvedValueOnce({ photos: [a, c], total: 2 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [b])
    })

    expect(result.current.selectedIds).toEqual(new Set([c.id]))
    expect(result.current.anchorId).toBe(c.id)
  })

  it('keeps the viewer open on the next photo when deleting the one shown', async () => {
    const store = createStore()
    const [a, b, c] = ['a', 'b', 'c'].map((id) => makePhoto(id))
    store.set(photosAtom, [a, b, c])
    store.set(previewPhotoIdAtom, c.id)
    scanFolderPage.mockResolvedValueOnce({ photos: [a, b], total: 2 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [c])
    })

    // The last photo has no next one, so the viewer steps back.
    expect(result.current.previewId).toBe(b.id)
  })

  it('puts the deleted photos back on undo and selects them', async () => {
    const store = createStore()
    const [a, b] = ['a', 'b'].map((id) => makePhoto(id))
    store.set(photosAtom, [a, b])
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [a])
    })
    expect(store.get(undoableDeletionAtom)?.trashed).toEqual([
      { path: a.path, trashPath: `/.Trash${a.path}`, rating: 0 },
    ])

    scanFolderPage.mockResolvedValueOnce({ photos: [a, b], total: 2 })
    await act(async () => {
      await result.current.undo()
    })

    expect(restorePhotos).toHaveBeenCalledWith('/folder', [{ path: a.path, trashPath: `/.Trash${a.path}`, rating: 0 }])
    expect(result.current.photos).toEqual([a, b])
    expect(result.current.selectedIds).toEqual(new Set([a.id]))
    expect(store.get(undoableDeletionAtom)).toBeNull()
  })

  it('deletes from the Photos library without offering undo', async () => {
    deletePhotos.mockImplementationOnce(async (_folder: string, paths: string[]) => ({
      trashed: [],
      deleted: paths,
      failures: [],
    }))
    const store = createStore()
    const [a, b] = ['A', 'B'].map((name) => libraryPhoto(name))
    store.set(photosAtom, [a, b])
    store.set(selectedPhotoIdsAtom, new Set([a.id]))
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { result } = renderWithStore(store, 'photos:')

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [a])
    })

    expect(deletePhotos).toHaveBeenCalledWith('photos:', [a.path])
    expect(result.current.photos).toEqual([b])
    expect(result.current.selectedIds).toEqual(new Set([b.id]))
    expect(store.get(undoableDeletionAtom)).toBeNull()
  })

  it('reports the photos the backend could not trash', async () => {
    deletePhotos.mockResolvedValueOnce({ trashed: [], deleted: [], failures: ['a.jpg: locked'] })
    const store = createStore()
    const a = makePhoto('a')
    store.set(photosAtom, [a])
    scanFolderPage.mockResolvedValueOnce({ photos: [a], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [a])
    })

    expect(message).toHaveBeenCalledWith('删除失败：a.jpg: locked', expect.anything())
    expect(store.get(undoableDeletionAtom)).toBeNull()
  })

  it('bulk-deletes every selected photo in one call and clears them from selection', async () => {
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
      const pending = result.current.deletePhoto([a, b])
      await answerDialog(store, (photos) => photos)
      await pending
    })

    expect(ask).not.toHaveBeenCalled()
    expect(deletePhotos).toHaveBeenCalledTimes(1)
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path, b.path])
    expect(result.current.photos).toEqual([c])
    expect(scanFolderPage).toHaveBeenCalledWith('/folder', 0, 300)
    expect(result.current.selectedIds).toEqual(new Set())
    expect(result.current.anchorId).toBeNull()
    expect(result.current.previewId).toBeNull()
  })

  it('shows an error and keeps the photo when the backend call fails', async () => {
    deletePhotos.mockRejectedValueOnce(new Error('boom'))
    const store = createStore()
    const a = makePhoto('a')
    store.set(photosAtom, [a])
    scanFolderPage.mockResolvedValueOnce({ photos: [a], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [a])
    })

    expect(message).toHaveBeenCalledTimes(1)
    expect(scanFolderPage).toHaveBeenCalledTimes(1)
    expect(result.current.photos).toEqual([a])
  })

  it('refreshes actual remaining files after a partial deletion failure', async () => {
    deletePhotos.mockRejectedValueOnce(new Error('Finder busy'))
    const store = createStore()
    const a = makePhoto('a')
    const b = makePhoto('b')
    store.set(photosAtom, [a, b])
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { result } = renderWithStore(store)

    await act(async () => {
      const pending = result.current.deletePhoto([a, b])
      await answerDialog(store, (photos) => photos)
      await pending
    })

    expect(result.current.photos).toEqual([b])
    expect(message).toHaveBeenCalledTimes(1)
  })

  it('does not navigate back when the folder changed during deletion', async () => {
    const store = createStore()
    deletePhotos.mockImplementationOnce(async () => {
      store.set(currentFolderAtom, '/other')
    })
    const { result } = renderWithStore(store)

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [makePhoto('a')])
    })

    expect(scanFolderPage).not.toHaveBeenCalled()
    expect(store.get(currentFolderAtom)).toBe('/other')
  })

  it('shares the pending guard across deletion entry points until refresh finishes', async () => {
    let finishRefresh!: (value: { photos: Photo[]; total: number }) => void
    scanFolderPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        }),
    )
    const store = createStore()
    const first = renderWithStore(store)
    const second = renderWithStore(store)
    const [a, b] = ['a', 'b'].map((id) => makePhoto(id))

    await act(async () => {
      const pending = first.result.current.deletePhoto([a, b])
      // Waiting on the dialog: a second request is ignored.
      await second.result.current.deletePhoto([a])
      await answerDialog(store, (photos) => photos)
      // Allow the backend operation to settle; the refresh is still running.
      await Promise.resolve()
      await Promise.resolve()
      await second.result.current.deletePhoto([a])
      finishRefresh({ photos: [], total: 0 })
      await pending
    })
    expect(deletePhotos).toHaveBeenCalledTimes(1)
  })

  it('allows another attempt after cancellation', async () => {
    const store = createStore()
    const { result } = renderWithStore(store)
    const [a, b] = ['a', 'b'].map((id) => makePhoto(id))
    await act(async () => {
      const cancelled = result.current.deletePhoto([a, b])
      await answerDialog(store, () => null)
      await cancelled
      const confirmed = result.current.deletePhoto([a, b])
      await answerDialog(store, (photos) => photos)
      await confirmed
    })
    expect(deletePhotos).toHaveBeenCalledTimes(1)
  })

  it('deletes only the photos still in the bulk dialog', async () => {
    const store = createStore()
    const a = makePhoto('a')
    const b = makePhoto('b')
    const c = makePhoto('c')
    const { result } = renderWithStore(store)

    await act(async () => {
      const pending = result.current.deletePhoto([a, b, c])
      await answerDialog(store, (photos) => photos.filter((p) => p.id !== b.id))
      await pending
    })

    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path, c.path])
  })

  it('does nothing when the bulk dialog is cancelled or emptied', async () => {
    const store = createStore()
    const { result } = renderWithStore(store)
    const photos = [makePhoto('a'), makePhoto('b')]

    await act(async () => {
      const cancelled = result.current.deletePhoto(photos)
      await answerDialog(store, () => null)
      await cancelled
      const emptied = result.current.deletePhoto(photos)
      await answerDialog(store, () => [])
      await emptied
    })

    expect(deletePhotos).not.toHaveBeenCalled()
  })

  it('blocks bulk deletion, but not a single photo, while thumbnails prefetch', async () => {
    const store = createStore()
    store.set(thumbnailProgressAtom, { total: 10, done: 3 })
    const { result } = renderWithStore(store)
    const a = makePhoto('a')

    await act(async () => {
      await result.current.deletePhoto([a, makePhoto('b')])
    })
    expect(store.get(deleteConfirmRequestAtom)).toBeNull()

    await act(async () => {
      await deleteConfirmed(store, result.current.deletePhoto, [a])
    })
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path])
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
