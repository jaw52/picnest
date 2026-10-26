import { act, render, screen, waitFor } from '@testing-library/react'
import { createStore, Provider, useAtom, useAtomValue } from 'jotai'
import { expect, it, vi } from 'vitest'

import { currentFolderAtom, isScanningAtom, ratingFilterAtom, selectedPhotoIdsAtom } from '~/atoms/gallery'
import { tabsStateAtom } from '~/atoms/tabs'
import { createTab } from '~/lib/tabs'

import { TabPane } from './TabPane'

const { scanFolderPage, watchFolder, unwatchFolder } = vi.hoisted(() => ({
  scanFolderPage: vi.fn(async (folder: string) => ({
    photos: ['1', '2'].map((name) => ({ path: `${folder}/${name}.jpg`, width: 3, height: 2, rating: 0 })),
    total: 2,
  })),
  watchFolder: vi.fn().mockResolvedValue(undefined),
  unwatchFolder: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('~/lib/backend', () => ({
  scanFolderPage,
  watchFolder,
  unwatchFolder,
  listSubfolders: vi.fn().mockResolvedValue([]),
}))

vi.mock('~/mygo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/mygo')>()),
  events: { folderChanged: { on: () => () => {} } },
}))

// The tab's own gallery, in place of the grid: what it shows and a way to
// change it.
function Probe() {
  const folder = useAtomValue(currentFolderAtom)
  const scanning = useAtomValue(isScanningAtom)
  const [filter, setFilter] = useAtom(ratingFilterAtom)
  const [selected, setSelected] = useAtom(selectedPhotoIdsAtom)
  return (
    <div data-scanning={scanning} data-testid={`probe:${folder}`}>
      {`${folder} filter=${filter} selected=${[...selected].join(',')}`}
      <button
        type="button"
        onClick={() => {
          setFilter(0)
          setSelected(new Set([`${folder}/2.jpg`]))
        }}
      >
        {`change ${folder}`}
      </button>
    </div>
  )
}
vi.mock('~/modules/gallery/MasonryView', () => ({ MasonryView: Probe }))
vi.mock('~/modules/gallery/FilterBar', () => ({ FilterBar: () => null }))
vi.mock('~/modules/gallery/ThumbnailProgressBar', () => ({ ThumbnailProgressBar: () => null }))
vi.mock('~/modules/gallery/PhotoInfo', () => ({ PhotoInfoPopover: () => null }))
vi.mock('~/modules/gallery/PhotoPreview', () => ({ PhotoPreview: () => null }))
vi.mock('~/modules/gallery/DeleteConfirmDialog', () => ({ DeleteConfirmDialog: () => null }))
vi.mock('~/modules/gallery/UndoToast', () => ({ UndoToast: () => null }))
vi.mock('./NewTabPage', () => ({ NewTabPage: () => null }))

function Tabs() {
  const { tabs, activeId } = useAtomValue(tabsStateAtom)
  return tabs.map((tab) => <TabPane active={tab.id === activeId} controlsSlot={null} key={tab.id} tab={tab} />)
}

it("keeps each tab's folder, filter and selection while another is shown, without rescanning", async () => {
  const store = createStore()
  const a = createTab('/a')
  const b = createTab('/b')
  store.set(tabsStateAtom, { tabs: [a, b], activeId: a.id })
  render(
    <Provider store={store}>
      <Tabs />
    </Provider>,
  )
  await waitFor(() => expect(screen.getByTestId('probe:/a').dataset.scanning).toBe('false'))
  act(() => screen.getByText('change /a').click())
  expect(screen.getByTestId('probe:/a').textContent).toContain('/a filter=0 selected=/a/2.jpg')

  act(() => store.set(tabsStateAtom, (prev) => ({ ...prev, activeId: b.id })))
  await waitFor(() => expect(screen.getByTestId('probe:/b').dataset.scanning).toBe('false'))
  // The other tab has a gallery of its own.
  expect(screen.getByTestId('probe:/b').textContent).toContain('/b filter=null selected=')
  expect(watchFolder).toHaveBeenCalledWith('/a')
  expect(watchFolder).toHaveBeenCalledWith('/b')

  const scans = scanFolderPage.mock.calls.length
  act(() => store.set(tabsStateAtom, (prev) => ({ ...prev, activeId: a.id })))
  expect(screen.getByTestId('probe:/a').textContent).toContain('/a filter=0 selected=/a/2.jpg')
  expect(scanFolderPage.mock.calls.length).toBe(scans)
})

it("stops watching a tab's folder once the tab goes", async () => {
  const store = createStore()
  const a = createTab('/gone')
  const b = createTab(null)
  store.set(tabsStateAtom, { tabs: [a, b], activeId: b.id })
  render(
    <Provider store={store}>
      <Tabs />
    </Provider>,
  )
  await waitFor(() => expect(watchFolder).toHaveBeenCalledWith('/gone'))
  act(() => store.set(tabsStateAtom, { tabs: [b], activeId: b.id }))
  await waitFor(() => expect(unwatchFolder).toHaveBeenCalledWith('/gone'))
})
