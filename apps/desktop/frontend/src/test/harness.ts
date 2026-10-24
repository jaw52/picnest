import type { Component } from 'vue'
import type { Gallery } from '~/state/gallery'
import { mount } from '@vue/test-utils'
import { TooltipProvider } from 'reka-ui'
import { defineComponent, h } from 'vue'
import { provideGallery } from '~/state/gallery'

/** Mounts `component` with `props` inside a tab, with a gallery of its own; `prepare` fills it in first. */
export function mountInTab(component: Component, props: Record<string, unknown> = {}, prepare?: (gallery: Gallery) => void) {
  let gallery!: Gallery
  const Tab = defineComponent({
    setup() {
      gallery = provideGallery()
      prepare?.(gallery)
      return () => h(TooltipProvider, null, () => h(component, props))
    },
  })
  const wrapper = mount(Tab, { attachTo: document.body })
  return { wrapper, gallery }
}

/** Runs `setup` as a component's setup inside a tab, as a composable runs in a component. */
export function setupInTab<T>(setup: () => T, prepare?: (gallery: Gallery) => void) {
  let result!: T
  const Host = defineComponent({
    setup() {
      result = setup()
      return () => null
    },
  })
  const { wrapper, gallery } = mountInTab(Host, {}, prepare)
  return { result, gallery, wrapper }
}
