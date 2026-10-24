import type { Photo } from '~/types/photo'
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import TileCaption from './TileCaption.vue'

const photo: Photo = {
  id: '/f/a.jpg',
  path: '/f/a.jpg',
  fileName: 'a.jpg',
  width: 300,
  height: 200,
  rating: 3,
  modified: 0,
  taken: 0,
  isCloudPlaceholder: false,
  aspectRatio: 1.5,
}

it('unfolds the rating row from the rating button, and rates or clears with it', async () => {
  const wrapper = mount(TileCaption, { props: { photo } })
  const button = wrapper.get('[aria-label="评分"]')
  expect(button.text()).toContain('3')
  expect(button.attributes('aria-expanded')).toBe('false')
  await button.trigger('mouseenter')
  expect(button.attributes('aria-expanded')).toBe('true')
  await wrapper.get('[aria-label="5 星"]').trigger('click')
  expect(wrapper.emitted('rate')?.at(-1)).toEqual([5])
  await wrapper.get('[aria-label="未评分"]').trigger('click')
  expect(wrapper.emitted('rate')?.at(-1)).toEqual([0])
})
