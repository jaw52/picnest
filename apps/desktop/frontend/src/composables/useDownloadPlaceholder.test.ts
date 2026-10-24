import type { Photo } from '~/types/photo'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setupInTab } from '~/test/harness'
import { downloadingIds, useDownloadPlaceholder } from './useDownloadPlaceholder'

const { downloadPlaceholder, refreshFolder } = vi.hoisted(() => ({
  downloadPlaceholder: vi.fn(),
  refreshFolder: vi.fn(),
}))
vi.mock('~/lib/backend', () => ({ downloadPlaceholder }))
vi.mock('~/lib/native', () => ({ message: vi.fn() }))
vi.mock('./useOpenFolder', () => ({ useOpenFolder: () => ({ refreshFolder }) }))

const placeholder: Photo = {
  id: '/a.jpg',
  path: '/a.jpg',
  fileName: 'a.jpg',
  width: 1,
  height: 1,
  rating: 0,
  modified: 0,
  taken: 0,
  isCloudPlaceholder: true,
  aspectRatio: 1,
}

beforeEach(() => {
  vi.useFakeTimers()
  downloadPlaceholder.mockReset().mockResolvedValue(undefined)
  refreshFolder.mockReset().mockResolvedValue(true)
})
afterEach(() => vi.useRealTimers())

function setup() {
  return setupInTab(() => useDownloadPlaceholder('/f'), (gallery) => {
    gallery.currentFolder.value = '/f'
    gallery.photos.value = [placeholder]
  })
}

it('marks the photo as downloading and re-scans until it is no longer a placeholder', async () => {
  const { result: download, gallery } = setup()

  const done = download(placeholder)
  await vi.advanceTimersByTimeAsync(0)
  expect(downloadPlaceholder).toHaveBeenCalledWith('/a.jpg')
  expect(downloadingIds.value.has(placeholder.id)).toBe(true)

  // The first re-scan still sees a placeholder; the second sees the real file.
  await vi.advanceTimersByTimeAsync(2000)
  expect(downloadingIds.value.has(placeholder.id)).toBe(true)
  gallery.photos.value = [{ ...placeholder, isCloudPlaceholder: false }]
  await vi.advanceTimersByTimeAsync(2000)
  await done

  expect(refreshFolder).toHaveBeenCalledTimes(2)
  expect(downloadingIds.value.size).toBe(0)
})

it('ignores a second request while one is in flight', async () => {
  const { result: download } = setup()
  void download(placeholder)
  void download(placeholder)
  await vi.advanceTimersByTimeAsync(0)
  expect(downloadPlaceholder).toHaveBeenCalledTimes(1)
})
