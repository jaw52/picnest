import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarRating from './StarRating.vue'

describe('starRating', () => {
  it('clicking a star reports that star\'s value', async () => {
    const wrapper = mount(StarRating, { props: { rating: 0 } })
    await wrapper.get('[aria-label="3 星"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[3]])
  })

  it('clicking the currently-set star clears the rating', async () => {
    const wrapper = mount(StarRating, { props: { rating: 3 } })
    await wrapper.get('[aria-label="3 星"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[0]])
  })

  it('has a button that clears the rating', async () => {
    const wrapper = mount(StarRating, { props: { rating: 4 } })
    await wrapper.get('[aria-label="未评分"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[0]])
  })
})
