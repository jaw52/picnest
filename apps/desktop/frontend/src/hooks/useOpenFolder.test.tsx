import { act, renderHook } from '@testing-library/react'
import { createStore, Provider, useAtomValue } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { photoGroupingAtom, photosAtom } from '~/atoms/gallery'
import { recentFoldersAtom } from '~/atoms/recentFolders'
import { scanFolderPage } from '~/lib/backend'

import { useOpenFolder } from './useOpenFolder'

vi.mock('~/lib/backend', () => ({
  scanFolderPage: vi.fn().mockResolvedValue({ photos: [], total: 0 }),
  watchFolder: vi.fn().mockResolvedValue(undefined),
  listSubfolders: vi.fn().mockResolvedValue([]),
}))

function renderWithStore(store: ReturnType<typeof createStore>) {
  return renderHook(
    () => ({
      openFolder: useOpenFolder(),
      recentFolders: useAtomValue(recentFoldersAtom),
    }),
    { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> },
  )
}

describe('useOpenFolder', () => {
  it('navigateToFolder loads the folder without bookmarking it', async () => {
    const store = createStore()
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.openFolder.navigateToFolder('/a/b/nested')
    })

    expect(result.current.openFolder.currentFolder).toBe('/a/b/nested')
    expect(result.current.recentFolders).toEqual([])
  })

  it('loads every page of a folder once', async () => {
    const files = mockFolder(700)
    const store = createStore()
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.openFolder.navigateToFolder('/f')
    })

    expect(store.get(photosAtom).map(p => p.path)).toEqual(files.map(f => f.path))
  })

  it('holds back the later pages while grouped, until the scan is done', async () => {
    const files = mockFolder(700)
    const store = createStore()
    store.set(photoGroupingAtom, 'month')
    const shown: number[] = []
    const scan = vi.mocked(scanFolderPage).getMockImplementation()!
    vi.mocked(scanFolderPage).mockImplementation(async (...args) => {
      shown.push(store.get(photosAtom).length)
      return scan(...args)
    })
    const { result } = renderWithStore(store)

    await act(async () => {
      await result.current.openFolder.navigateToFolder('/f')
    })

    // Fetching the first page, the second, then the third.
    expect(shown).toEqual([0, 300, 300])
    expect(store.get(photosAtom).map(p => p.path)).toEqual(files.map(f => f.path))
  })
})

/** Has scanFolderPage serve a folder of `count` photos, and returns them. */
function mockFolder(count: number) {
  const meta = (path: string) => ({
    path,
    fileName: path,
    width: 1,
    height: 1,
    rating: 0,
    modified: 0,
    taken: 0,
    isCloudPlaceholder: false,
  })
  const files = Array.from({ length: count }, (_, i) => meta(`/f/${i}.jpg`))
  vi.mocked(scanFolderPage).mockImplementation(async (_folder, offset, limit) => (
    { photos: files.slice(offset, offset + limit), total: files.length }
  ))
  return files
}
