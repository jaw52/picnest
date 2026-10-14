import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { expect, it, vi } from 'vitest'

import {
  isScanningAtom,
  pendingScrollAtom,
  photosAtom,
  ratingFilterAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { tabsStateAtom } from '~/atoms/tabs'
import { createTab } from '~/lib/tabs'

import { useActiveTabSync } from './useTabs'

vi.mock('~/lib/backend', () => ({
  scanFolderPage: vi.fn(async (folder: string) => ({
    photos: ['1', '2'].map(name => ({ path: `${folder}/${name}.jpg`, width: 3, height: 2, rating: 0 })),
    total: 2,
  })),
  watchFolder: vi.fn().mockResolvedValue(undefined),
  unwatchFolder: vi.fn().mockResolvedValue(undefined),
  listSubfolders: vi.fn().mockResolvedValue([]),
}))

it('puts a tab\'s scroll position, filter and selection back when it is switched to again', async () => {
  const store = createStore()
  const a = createTab('/a')
  const b = createTab('/b')
  store.set(tabsStateAtom, { tabs: [a, b], activeId: a.id })
  renderHook(() => useActiveTabSync(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  })
  await waitFor(() => expect(store.get(isScanningAtom)).toBe(false))

  act(() => {
    store.set(selectedPhotoIdsAtom, new Set(['/a/2.jpg']))
    store.set(selectedPhotoIdAtom, '/a/2.jpg')
    store.set(ratingFilterAtom, 0)
    window.scrollY = 420
    window.dispatchEvent(new Event('scroll'))
  })

  act(() => store.set(tabsStateAtom, prev => ({ ...prev, activeId: b.id })))
  // The grid keeps the previous folder until the next one has loaded.
  expect(store.get(photosAtom).map(p => p.id)).toEqual(['/a/1.jpg', '/a/2.jpg'])
  await waitFor(() => expect(store.get(isScanningAtom)).toBe(false))
  // The other tab starts unfiltered, unselected and at the top.
  expect(store.get(photosAtom).map(p => p.id)).toEqual(['/b/1.jpg', '/b/2.jpg'])
  expect(store.get(ratingFilterAtom)).toBe(null)
  expect(store.get(selectedPhotoIdsAtom).size).toBe(0)
  expect(store.get(pendingScrollAtom)).toBe(0)

  act(() => store.set(tabsStateAtom, prev => ({ ...prev, activeId: a.id })))
  await waitFor(() => expect(store.get(isScanningAtom)).toBe(false))
  expect(store.get(ratingFilterAtom)).toBe(0)
  expect(store.get(pendingScrollAtom)).toBe(420)
  expect(store.get(selectedPhotoIdsAtom)).toEqual(new Set(['/a/2.jpg']))
  expect(store.get(selectedPhotoIdAtom)).toBe('/a/2.jpg')
})
