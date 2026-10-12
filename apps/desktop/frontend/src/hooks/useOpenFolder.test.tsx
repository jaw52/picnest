import { act, renderHook } from '@testing-library/react'
import { createStore, Provider, useAtomValue } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { recentFoldersAtom } from '~/atoms/recentFolders'

import { useOpenFolder } from './useOpenFolder'

vi.mock('~/lib/backend', () => ({
  scanFolderPage: vi.fn().mockResolvedValue({ photos: [], total: 0 }),
  watchFolder: vi.fn().mockResolvedValue(undefined),
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
})
