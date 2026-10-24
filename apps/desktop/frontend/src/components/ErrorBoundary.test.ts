import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ErrorBoundary from './ErrorBoundary.vue'

const Boom = defineComponent({
  setup: () => () => {
    throw new Error('kaboom')
  },
})

function mountBoundary(resetKey: string, child: () => ReturnType<typeof h>) {
  return mount(defineComponent({
    props: { resetKey: { type: String, required: true }, broken: { type: Boolean, default: true } },
    setup: props => () => h(ErrorBoundary, { resetKey: props.resetKey }, () => (props.broken ? h(Boom) : child())),
  }), { props: { resetKey } })
}

describe('errorBoundary', () => {
  it('renders a fallback with the error message instead of a blank page', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountBoundary('a', () => h('div'))
    await nextTick()
    expect(wrapper.text()).toContain('kaboom')
    consoleError.mockRestore()
  })

  it('recovers once resetKey changes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountBoundary('a', () => h('div', 'recovered'))
    await nextTick()
    expect(wrapper.text()).toContain('kaboom')

    await wrapper.setProps({ resetKey: 'b', broken: false })
    expect(wrapper.text()).toContain('recovered')
    consoleError.mockRestore()
  })
})
