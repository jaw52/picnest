import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { currentFolderAtom, photosAtom } from '~/atoms/gallery'
import type { Photo } from '~/types/photo'

import { downloadingIdsAtom, useDownloadPlaceholder } from './useDownloadPlaceholder'

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

it('marks the photo as downloading and re-scans until it is no longer a placeholder', async () => {
  const store = createStore()
  store.set(currentFolderAtom, '/f')
  store.set(photosAtom, [placeholder])
  const { result } = renderHook(() => useDownloadPlaceholder('/f'), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  })

  let done: Promise<void> | undefined
  await act(async () => {
    done = result.current(placeholder)
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(downloadPlaceholder).toHaveBeenCalledWith('/a.jpg')
  expect(store.get(downloadingIdsAtom).has(placeholder.id)).toBe(true)

  // The first re-scan still sees a placeholder; the second sees the real file.
  await act(() => vi.advanceTimersByTimeAsync(2000))
  expect(store.get(downloadingIdsAtom).has(placeholder.id)).toBe(true)
  store.set(photosAtom, [{ ...placeholder, isCloudPlaceholder: false }])
  await act(() => vi.advanceTimersByTimeAsync(2000))
  await done

  expect(refreshFolder).toHaveBeenCalledTimes(2)
  expect(store.get(downloadingIdsAtom).size).toBe(0)
})

it('ignores a second request while one is in flight', async () => {
  const store = createStore()
  store.set(currentFolderAtom, '/f')
  store.set(photosAtom, [placeholder])
  const { result } = renderHook(() => useDownloadPlaceholder('/f'), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  })
  await act(async () => {
    void result.current(placeholder)
    void result.current(placeholder)
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(downloadPlaceholder).toHaveBeenCalledTimes(1)
})
