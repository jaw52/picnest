import type { InjectionKey, Ref } from 'vue'
import { computed, inject, provide } from 'vue'

/**
 * Whether the tab this is in is the one shown. A tab not shown keeps its
 * folder up to date, but runs nothing else: no shortcuts, no thumbnail
 * prefetching. Outside any tab (the collect panel, tests) it counts as shown.
 */
const tabActiveKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('tab-active')

export function provideTabActive(active: () => boolean): void {
  provide(tabActiveKey, computed(active))
}

export function useTabActive(): Readonly<Ref<boolean>> {
  return inject(tabActiveKey, computed(() => true))
}
