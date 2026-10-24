import type { Gallery } from '~/state/gallery'
import type { Photo } from '~/types/photo'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupInTab } from '~/test/harness'
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
  return { trashed: paths.map(path => ({ path, trashPath: `/.Trash${path}`, rating: 0 })), deleted: [], failures: [] }
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

/** Answers the bulk-delete dialog once the operation has opened it. */
async function answerDialog(gallery: Gallery, keep: (photos: Photo[]) => Photo[] | null) {
  await Promise.resolve()
  const request = gallery.deleteConfirmRequest.value
  expect(request).not.toBeNull()
  request!.resolve(keep(request!.photos))
  gallery.deleteConfirmRequest.value = null
}

/** Deletes `photos`, confirming them in the dialog. */
async function deleteConfirmed(gallery: Gallery, deletePhoto: (photos: Photo[]) => Promise<void>, photos: Photo[]) {
  const pending = deletePhoto(photos)
  await answerDialog(gallery, kept => kept)
  await pending
}

function setup(prepare: (gallery: Gallery) => void = () => {}, folder = '/folder') {
  const { result, gallery } = setupInTab(() => ({
    deletePhoto: useDeletePhoto(folder),
    undo: useUndoDeletion(),
  }), (g) => {
    g.currentFolder.value = folder
    prepare(g)
  })
  return { ...result, gallery }
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
    const a = makePhoto('a')
    const b = makePhoto('b')
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a, b]
    })

    await deleteConfirmed(gallery, deletePhoto, [a])

    expect(ask).not.toHaveBeenCalled()
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path])
    expect(gallery.photos.value).toEqual([b])
  })

  it('selects the photo after a deleted one, ready for the next delete', async () => {
    const [a, b, c] = ['a', 'b', 'c'].map(id => makePhoto(id))
    scanFolderPage.mockResolvedValueOnce({ photos: [a, c], total: 2 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a, b, c]
      g.selectedPhotoIds.value = new Set([b.id])
      g.selectedPhotoId.value = b.id
    })

    await deleteConfirmed(gallery, deletePhoto, [b])

    expect(gallery.selectedPhotoIds.value).toEqual(new Set([c.id]))
    expect(gallery.selectedPhotoId.value).toBe(c.id)
  })

  it('keeps the viewer open on the next photo when deleting the one shown', async () => {
    const [a, b, c] = ['a', 'b', 'c'].map(id => makePhoto(id))
    scanFolderPage.mockResolvedValueOnce({ photos: [a, b], total: 2 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a, b, c]
      g.setPreviewPhotoId(c.id)
    })

    await deleteConfirmed(gallery, deletePhoto, [c])

    // The last photo has no next one, so the viewer steps back.
    expect(gallery.previewPhotoId.value).toBe(b.id)
  })

  it('puts the deleted photos back on undo and selects them', async () => {
    const [a, b] = ['a', 'b'].map(id => makePhoto(id))
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { deletePhoto, undo, gallery } = setup((g) => {
      g.photos.value = [a, b]
    })

    await deleteConfirmed(gallery, deletePhoto, [a])
    expect(gallery.undoableDeletion.value?.trashed).toEqual([
      { path: a.path, trashPath: `/.Trash${a.path}`, rating: 0 },
    ])

    scanFolderPage.mockResolvedValueOnce({ photos: [a, b], total: 2 })
    await undo()

    expect(restorePhotos).toHaveBeenCalledWith('/folder', [
      { path: a.path, trashPath: `/.Trash${a.path}`, rating: 0 },
    ])
    expect(gallery.photos.value).toEqual([a, b])
    expect(gallery.selectedPhotoIds.value).toEqual(new Set([a.id]))
    expect(gallery.undoableDeletion.value).toBeNull()
  })

  it('deletes from the Photos library without offering undo', async () => {
    deletePhotos.mockImplementationOnce(async (_folder: string, paths: string[]) => ({ trashed: [], deleted: paths, failures: [] }))
    const [a, b] = ['A', 'B'].map(name => libraryPhoto(name))
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a, b]
      g.selectedPhotoIds.value = new Set([a.id])
    }, 'photos:')

    await deleteConfirmed(gallery, deletePhoto, [a])

    expect(deletePhotos).toHaveBeenCalledWith('photos:', [a.path])
    expect(gallery.photos.value).toEqual([b])
    expect(gallery.selectedPhotoIds.value).toEqual(new Set([b.id]))
    expect(gallery.undoableDeletion.value).toBeNull()
  })

  it('reports the photos the backend could not trash', async () => {
    deletePhotos.mockResolvedValueOnce({ trashed: [], deleted: [], failures: ['a.jpg: locked'] })
    const a = makePhoto('a')
    scanFolderPage.mockResolvedValueOnce({ photos: [a], total: 1 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a]
    })

    await deleteConfirmed(gallery, deletePhoto, [a])

    expect(message).toHaveBeenCalledWith('删除失败：a.jpg: locked', expect.anything())
    expect(gallery.undoableDeletion.value).toBeNull()
  })

  it('bulk-deletes every selected photo in one call and clears them from selection', async () => {
    const a = makePhoto('a')
    const b = makePhoto('b')
    const c = makePhoto('c')
    scanFolderPage.mockResolvedValueOnce({ photos: [c], total: 1 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a, b, c]
      g.selectedPhotoIds.value = new Set(['a', 'b', 'c'])
      g.selectedPhotoId.value = 'b'
      g.setPreviewPhotoId('a')
    })

    const pending = deletePhoto([a, b])
    await answerDialog(gallery, photos => photos)
    await pending

    expect(ask).not.toHaveBeenCalled()
    expect(deletePhotos).toHaveBeenCalledTimes(1)
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path, b.path])
    expect(gallery.photos.value).toEqual([c])
    expect(scanFolderPage).toHaveBeenCalledWith('/folder', 0, 300)
    expect(gallery.selectedPhotoIds.value).toEqual(new Set())
    expect(gallery.selectedPhotoId.value).toBeNull()
    expect(gallery.previewPhotoId.value).toBeNull()
  })

  it('shows an error and keeps the photo when the backend call fails', async () => {
    deletePhotos.mockRejectedValueOnce(new Error('boom'))
    const a = makePhoto('a')
    scanFolderPage.mockResolvedValueOnce({ photos: [a], total: 1 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a]
    })

    await deleteConfirmed(gallery, deletePhoto, [a])

    expect(message).toHaveBeenCalledTimes(1)
    expect(scanFolderPage).toHaveBeenCalledTimes(1)
    expect(gallery.photos.value).toEqual([a])
  })

  it('refreshes actual remaining files after a partial deletion failure', async () => {
    deletePhotos.mockRejectedValueOnce(new Error('Finder busy'))
    const a = makePhoto('a')
    const b = makePhoto('b')
    scanFolderPage.mockResolvedValueOnce({ photos: [b], total: 1 })
    const { deletePhoto, gallery } = setup((g) => {
      g.photos.value = [a, b]
    })

    const pending = deletePhoto([a, b])
    await answerDialog(gallery, photos => photos)
    await pending

    expect(gallery.photos.value).toEqual([b])
    expect(message).toHaveBeenCalledTimes(1)
  })

  it('does not navigate back when the folder changed during deletion', async () => {
    const { deletePhoto, gallery } = setup()
    deletePhotos.mockImplementationOnce(async () => {
      gallery.currentFolder.value = '/other'
    })

    await deleteConfirmed(gallery, deletePhoto, [makePhoto('a')])

    expect(scanFolderPage).not.toHaveBeenCalled()
    expect(gallery.currentFolder.value).toBe('/other')
  })

  it('shares the pending guard across deletion entry points until refresh finishes', async () => {
    let finishRefresh!: (value: { photos: Photo[], total: number }) => void
    scanFolderPage.mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          finishRefresh = resolve
        }),
    )
    const { result: { first, second }, gallery } = setupInTab(() => ({
      first: useDeletePhoto('/folder'),
      second: useDeletePhoto('/folder'),
    }), (g) => {
      g.currentFolder.value = '/folder'
    })
    const [a, b] = ['a', 'b'].map(id => makePhoto(id))

    const pending = first([a, b])
    // Waiting on the dialog: a second request is ignored.
    await second([a])
    await answerDialog(gallery, photos => photos)
    // Allow the backend operation to settle; the refresh is still running.
    await Promise.resolve()
    await Promise.resolve()
    await second([a])
    finishRefresh({ photos: [], total: 0 })
    await pending
    expect(deletePhotos).toHaveBeenCalledTimes(1)
  })

  it('allows another attempt after cancellation', async () => {
    const { deletePhoto, gallery } = setup()
    const [a, b] = ['a', 'b'].map(id => makePhoto(id))
    const cancelled = deletePhoto([a, b])
    await answerDialog(gallery, () => null)
    await cancelled
    const confirmed = deletePhoto([a, b])
    await answerDialog(gallery, photos => photos)
    await confirmed
    expect(deletePhotos).toHaveBeenCalledTimes(1)
  })

  it('deletes only the photos still in the bulk dialog', async () => {
    const a = makePhoto('a')
    const b = makePhoto('b')
    const c = makePhoto('c')
    const { deletePhoto, gallery } = setup()

    const pending = deletePhoto([a, b, c])
    await answerDialog(gallery, photos => photos.filter(p => p.id !== b.id))
    await pending

    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path, c.path])
  })

  it('does nothing when the bulk dialog is cancelled or emptied', async () => {
    const { deletePhoto, gallery } = setup()
    const photos = [makePhoto('a'), makePhoto('b')]

    const cancelled = deletePhoto(photos)
    await answerDialog(gallery, () => null)
    await cancelled
    const emptied = deletePhoto(photos)
    await answerDialog(gallery, () => [])
    await emptied

    expect(deletePhotos).not.toHaveBeenCalled()
  })

  it('blocks bulk deletion, but not a single photo, while thumbnails prefetch', async () => {
    const { deletePhoto, gallery } = setup((g) => {
      g.thumbnailProgress.value = { total: 10, done: 3 }
    })
    const a = makePhoto('a')

    await deletePhoto([a, makePhoto('b')])
    expect(gallery.deleteConfirmRequest.value).toBeNull()

    await deleteConfirmed(gallery, deletePhoto, [a])
    expect(deletePhotos).toHaveBeenCalledWith('/folder', [a.path])
  })

  it('is a no-op with an empty selection', async () => {
    const { deletePhoto } = setup()

    await deletePhoto([])

    expect(ask).not.toHaveBeenCalled()
    expect(deletePhotos).not.toHaveBeenCalled()
  })
})
