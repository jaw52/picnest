import type { Photo } from '~/types/photo'
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import Filmstrip from './Filmstrip.vue'

vi.mock('~/lib/backend', () => ({ ensureThumbnailUrl: async () => new Promise(() => {}), THUMBNAIL_CANCELLED: {} }))

const photos: Photo[] = Array.from({ length: 200 }, (_, i) => ({
  id: `/f/${i}.jpg`,
  path: `/f/${i}.jpg`,
  fileName: `${i}.jpg`,
  width: 3,
  height: 2,
  rating: 0,
  modified: 0,
  taken: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}))

const label = (name: string) => `[aria-label="${name}"]`

it('mounts the thumbnails in view around the current photo, and shows one on click', async () => {
  window.innerWidth = 1000
  const wrapper = mount(Filmstrip, { props: { photos, index: 100, folderPath: '/f' } })

  expect(wrapper.get(label('100.jpg')).attributes('aria-current')).toBe('true')
  // Thumbnails 91-109 show in the 1000px strip, with a few more mounted past each edge.
  expect(wrapper.find(label('87.jpg')).exists()).toBe(true)
  expect(wrapper.find(label('114.jpg')).exists()).toBe(true)
  expect(wrapper.find(label('86.jpg')).exists()).toBe(false)
  expect(wrapper.find(label('115.jpg')).exists()).toBe(false)

  await wrapper.get(label('103.jpg')).trigger('click')
  expect(wrapper.emitted('select')).toEqual([[103]])
})

it('scrolls on its own, without changing the photo or reaching the lightbox', async () => {
  window.innerWidth = 1000
  const onLightboxWheel = vi.fn()
  const wrapper = mount(defineComponent({
    setup: () => () => h('div', { onWheel: onLightboxWheel }, [h(Filmstrip, { photos, index: 100, folderPath: '/f' })]),
  }))
  const strip = wrapper.get('[role="presentation"]')

  await strip.trigger('wheel', { deltaX: 300 })
  expect(onLightboxWheel).not.toHaveBeenCalled()

  strip.element.scrollLeft = 150 * 54
  await strip.trigger('scroll')
  expect(wrapper.find(label('150.jpg')).exists()).toBe(true)
  expect(wrapper.find(label('100.jpg')).exists()).toBe(false)
  expect(wrapper.findComponent(Filmstrip).emitted('select')).toBeUndefined()
})
