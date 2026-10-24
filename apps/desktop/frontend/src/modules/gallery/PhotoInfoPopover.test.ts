import type { Photo } from '~/types/photo'
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { provideScrollContainer } from '~/context/scroll'
import { mountInTab } from '~/test/harness'
import PhotoInfoPopover from './PhotoInfoPopover.vue'

vi.mock('~/lib/backend', () => ({ getPhotoDetails: async () => new Promise(() => {}) }))
vi.mock('~/lib/native', () => ({ writeText: vi.fn() }))

const photo: Photo = {
  id: '/f/a.jpg',
  path: '/f/a.jpg',
  fileName: 'a.jpg',
  width: 300,
  height: 200,
  rating: 0,
  modified: 0,
  taken: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}

// The tab's scroller, holding the photo's tile the card opens beside.
const Scroller = defineComponent({
  setup() {
    const scroller = shallowRef<HTMLElement | null>(null)
    provideScrollContainer(scroller)
    return () => h('div', { ref: scroller }, [h('div', { 'data-photo-id': photo.id }), h(PhotoInfoPopover)])
  },
})

it('shows a photo\'s info beside its tile, and closes once the photo is gone', async () => {
  const { gallery } = mountInTab(Scroller, {}, (g) => {
    g.currentFolder.value = '/f'
    g.photos.value = [photo]
  })

  gallery.photoInfoId.value = photo.id
  await vi.waitFor(() => expect(document.body.textContent).toContain('300 × 200'))
  expect(document.body.textContent).toContain('a.jpg')

  gallery.photos.value = []
  await nextTick()
  await flushPromises()
  expect(gallery.photoInfoId.value).toBe(null)
})
