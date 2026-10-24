<script setup lang="ts">
import type { ItemRect } from '~/types/fluid-hover'
import { AnimatePresence, motion } from 'motion-v'
import { TabsList, TabsRoot } from 'reka-ui'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useFluidHover } from '~/composables/useFluidHover'
import { spring } from '~/lib/springs'
import { provideTabsSubtle } from './tabsSubtle'

const { selectedIndex } = defineProps<{ selectedIndex: number }>()
const emit = defineEmits<{ select: [index: number] }>()

const list = useTemplateRef<{ $el: HTMLElement }>('list')
const container = computed(() => list.value?.$el ?? null)
// Whether the pointer is over the list, read by blur and by the hover pill's
// exit, which slides back to the selection only once the pointer has left.
const mouseInside = shallowRef(false)
const focusedIndex = shallowRef<number | null>(null)

const { activeIndex: hoveredIndex, itemRects: tabRects, handlers, itemDirective } = useFluidHover(container, { axis: 'x' })

provideTabsSubtle({ tabDirective: itemDirective, hoveredIndex, selectedIndex: () => selectedIndex })

const selectedRect = computed(() => tabRects.value[selectedIndex])
const hoverRect = computed(() => (hoveredIndex.value === null ? null : tabRects.value[hoveredIndex.value] ?? null))
const focusRect = computed(() => (focusedIndex.value === null ? null : tabRects.value[focusedIndex.value] ?? null))
const isHoveringSelected = computed(() => hoveredIndex.value === selectedIndex)
const isHovering = computed(() => hoveredIndex.value !== null && !isHoveringSelected.value)

const box = (rect: ItemRect) => ({ left: rect.left, width: rect.width, top: rect.top, height: rect.height })

/** The hover pill's exit: back onto the selection once the pointer left, else just a fade. */
const hoverVariants = {
  exit: (inside: boolean) => (!inside && selectedRect.value
    ? { ...box(selectedRect.value), opacity: 0, transition: { ...spring.moderate, opacity: { duration: 0.06 } } }
    : { opacity: 0, transition: spring.fast.exit }),
}

function onMouseMove(e: MouseEvent) {
  mouseInside.value = true
  handlers.mousemove(e)
}

function onMouseLeave() {
  mouseInside.value = false
  handlers.mouseleave()
}

function onFocusIn(e: FocusEvent) {
  const indexAttr = (e.target as HTMLElement).closest<HTMLElement>('[data-fluid-hover-index]')?.dataset.fluidHoverIndex
  if (indexAttr === undefined)
    return
  const index = Number(indexAttr)
  hoveredIndex.value = index
  focusedIndex.value = (e.target as HTMLElement).matches(':focus-visible') ? index : null
}

function onFocusOut(e: FocusEvent) {
  if (container.value?.contains(e.relatedTarget as Node | null))
    return
  focusedIndex.value = null
  if (!mouseInside.value)
    hoveredIndex.value = null
}
</script>

<!--
  A row of text tabs over a sliding selection pill and a hover pill that
  springs between tabs. Reka owns role="tablist", roving tabindex and
  Arrow/Home/End keyboard navigation; arrows move focus and Enter/Space selects
  (manual activation). The pills are measured from the tabs' DOM rects.
-->
<template>
  <TabsRoot
    :model-value="selectedIndex"
    activation-mode="manual"
    class="contents"
    @update:model-value="value => emit('select', Number(value))"
  >
    <TabsList
      ref="list"
      class="list"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <motion.div
        v-if="selectedRect"
        class="pill"
        :initial="false"
        :animate="{ ...box(selectedRect), opacity: isHovering ? 0.8 : 1 }"
        :transition="{ ...spring.moderate, opacity: { duration: 0.08 } }"
      />
      <AnimatePresence :custom="mouseInside">
        <motion.div
          v-if="hoverRect && !isHoveringSelected && selectedRect"
          class="pill"
          :variants="hoverVariants"
          :initial="{ ...box(selectedRect), opacity: 0 }"
          :animate="{ ...box(hoverRect), opacity: 0.4 }"
          exit="exit"
          :transition="{ ...spring.fast, opacity: { duration: 0.08 } }"
        />
      </AnimatePresence>
      <AnimatePresence>
        <motion.div
          v-if="focusRect"
          class="focus-ring"
          :initial="false"
          :animate="{ left: focusRect.left - 2, top: focusRect.top - 2, width: focusRect.width + 4, height: focusRect.height + 4 }"
          :exit="{ opacity: 0, transition: spring.fast.exit }"
          :transition="{ ...spring.fast, opacity: { duration: 0.08 } }"
        />
      </AnimatePresence>
      <slot />
    </TabsList>
  </TabsRoot>
</template>

<style scoped>
/* The negative margins and matching padding give the 2px-outset focus ring
   room inside overflow-x. The max-width allows for the margins, so the first
   and last tab's ring is not clipped. */
.list {
  position: relative;
  display: flex;
  align-items: center;
  user-select: none;
  overflow-x: auto;
  max-width: calc(100% + 8px);
  min-width: 0;
  margin: -4px;
  padding: 4px;
  scrollbar-width: none;
}

.list::-webkit-scrollbar {
  display: none;
}

.pill {
  position: absolute;
  pointer-events: none;
  background-color: var(--ps-active);
  border-radius: 8px;
}

.focus-ring {
  position: absolute;
  pointer-events: none;
  z-index: 20;
  border: 1px solid var(--ps-focus-ring);
  border-radius: 10px;
}
</style>
