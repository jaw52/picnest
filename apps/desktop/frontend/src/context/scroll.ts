import type { InjectionKey, ShallowRef } from 'vue'
import { inject, provide, shallowRef } from 'vue'

/**
 * The element the grid scrolls in: each tab has one of its own, so a tab
 * switched back to is where it was left. Null until it mounts.
 */
const scrollContainerKey: InjectionKey<Readonly<ShallowRef<HTMLElement | null>>> = Symbol('scroll-container')

export function provideScrollContainer(scroller: Readonly<ShallowRef<HTMLElement | null>>): void {
  provide(scrollContainerKey, scroller)
}

export function useScrollContainer(): Readonly<ShallowRef<HTMLElement | null>> {
  return inject(scrollContainerKey, shallowRef(null))
}
