import type { InjectionKey, ObjectDirective, Ref } from 'vue'
import { inject, provide } from 'vue'

export interface TabsSubtleContext {
  /** Registers a tab under its index with the list's hover. */
  tabDirective: ObjectDirective<HTMLElement, number>
  hoveredIndex: Readonly<Ref<number | null>>
  selectedIndex: () => number
}

const tabsSubtleKey: InjectionKey<TabsSubtleContext> = Symbol('tabs-subtle')

export function provideTabsSubtle(context: TabsSubtleContext): void {
  provide(tabsSubtleKey, context)
}

export function useTabsSubtle(): TabsSubtleContext {
  const context = inject(tabsSubtleKey)
  if (!context)
    throw new Error('TabsSubtleItem must be used within a TabsSubtle')
  return context
}
