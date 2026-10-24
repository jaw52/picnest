import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createTab } from '~/lib/tabs'
import { useGallery } from '~/state/gallery'
import { activeTabId, tabsState } from '~/state/tabs'
import TabPane from './TabPane.vue'

const { scanFolderPage, watchFolder, unwatchFolder } = vi.hoisted(() => ({
  scanFolderPage: vi.fn(async (folder: string) => ({
    photos: ['1', '2'].map(name => ({ path: `${folder}/${name}.jpg`, width: 3, height: 2, rating: 0 })),
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

vi.mock('~/mygo', async importOriginal => ({
  ...await importOriginal<typeof import('~/mygo')>(),
  events: { folderChanged: { on: () => () => {} } },
}))

const { Probe, Empty } = vi.hoisted(() => {
  // The tab's own gallery, in place of the grid: what it shows and a way to
  // change it.
  const Probe = {
    setup() {
      const gallery = useGallery()
      return { gallery }
    },
    template: `
      <div :data-testid="'probe:' + gallery.currentFolder.value" :data-scanning="String(gallery.isScanning.value)">
        {{ gallery.currentFolder.value }} filter={{ gallery.ratingFilter.value }} selected={{ [...gallery.selectedPhotoIds.value].join(',') }}
        <button type="button" @click="gallery.ratingFilter.value = 0; gallery.selectedPhotoIds.value = new Set([gallery.currentFolder.value + '/2.jpg'])">
          change {{ gallery.currentFolder.value }}
        </button>
      </div>`,
  }
  const Empty = { render: () => null }
  return { Probe, Empty }
})
vi.mock('~/modules/gallery/MasonryView.vue', () => ({ default: Probe }))
vi.mock('~/modules/gallery/FilterBar.vue', () => ({ default: Empty }))
vi.mock('~/modules/gallery/FolderControls.vue', () => ({ default: Empty }))
vi.mock('~/modules/gallery/ThumbnailProgressBar.vue', () => ({ default: Empty }))
vi.mock('~/modules/gallery/PhotoInfoPopover.vue', () => ({ default: Empty }))
vi.mock('~/modules/gallery/PhotoPreview.vue', () => ({ default: Empty }))
vi.mock('~/modules/gallery/DeleteConfirmDialog.vue', () => ({ default: Empty }))
vi.mock('~/modules/gallery/UndoToast.vue', () => ({ default: Empty }))
vi.mock('./NewTabPage.vue', () => ({ default: Empty }))

const Tabs = defineComponent({
  setup: () => () => tabsState.value.tabs.map(tab => h(TabPane, { key: tab.id, tab, active: tab.id === activeTabId.value })),
})

beforeEach(() => {
  document.body.innerHTML = '<div id="folder-controls"></div>'
})

it('keeps each tab\'s folder, filter and selection while another is shown, without rescanning', async () => {
  const a = createTab('/a')
  const b = createTab('/b')
  tabsState.value = { tabs: [a, b], activeId: a.id }
  const wrapper = mount(Tabs, { attachTo: document.body })
  const probe = (folder: string) => wrapper.get(`[data-testid="probe:${folder}"]`)
  await vi.waitFor(() => expect(probe('/a').attributes('data-scanning')).toBe('false'))
  await wrapper.get('button').trigger('click')
  expect(probe('/a').text()).toContain('/a filter=0 selected=/a/2.jpg')

  tabsState.value = { ...tabsState.value, activeId: b.id }
  await vi.waitFor(() => expect(probe('/b').attributes('data-scanning')).toBe('false'))
  // The other tab has a gallery of its own.
  expect(probe('/b').text()).toContain('/b filter= selected=')
  expect(watchFolder).toHaveBeenCalledWith('/a')
  expect(watchFolder).toHaveBeenCalledWith('/b')

  const scans = scanFolderPage.mock.calls.length
  tabsState.value = { ...tabsState.value, activeId: a.id }
  await flushPromises()
  expect(probe('/a').text()).toContain('/a filter=0 selected=/a/2.jpg')
  expect(scanFolderPage.mock.calls.length).toBe(scans)
})

it('stops watching a tab\'s folder once the tab goes', async () => {
  const a = createTab('/gone')
  const b = createTab(null)
  tabsState.value = { tabs: [a, b], activeId: b.id }
  mount(Tabs, { attachTo: document.body })
  await vi.waitFor(() => expect(watchFolder).toHaveBeenCalledWith('/gone'))
  tabsState.value = { tabs: [b], activeId: b.id }
  await vi.waitFor(() => expect(unwatchFolder).toHaveBeenCalledWith('/gone'))
})
