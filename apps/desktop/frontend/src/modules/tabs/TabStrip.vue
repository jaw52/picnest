<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import FluidHoverHighlight from '~/components/FluidHoverHighlight.vue'
import IconButton from '~/components/IconButton.vue'
import { useFluidHover } from '~/composables/useFluidHover'
import { activeTabId, newTab, tabsState } from '~/state/tabs'
import TabItem from './TabItem.vue'

const { t } = useI18n()

const list = useTemplateRef<{ $el: HTMLElement }>('list')
const container = computed(() => list.value?.$el ?? null)
// Tabs open on mouse down, so a click in a gap has nothing to route to.
const hover = useFluidHover(container, { axis: 'x', gapClick: false })
const { activeIndex: hoveredIndex, itemRects, isMeasured, handlers } = hover

const activeIndex = computed(() => tabsState.value.tabs.findIndex(tab => tab.id === activeTabId.value))
const selectedRect = computed(() => (isMeasured.value ? itemRects.value[activeIndex.value] : undefined))
</script>

<template>
  <div class="flex shrink gap-0.5 min-w-0 items-center self-stretch">
    <!-- In the sticky header, a shorter page clamping the window's scroll
         would look to motion like the tabs moving by that much. layoutRoot
         measures them against the strip; it needs `layout` to be measured. -->
    <motion.div
      ref="list"
      layout
      layout-root
      role="tablist"
      :aria-label="t('tabs.list')"
      class="flex shrink gap-[3px] min-w-0 items-end self-stretch relative"
      @mousemove="handlers.mousemove"
      @mouseenter="handlers.mouseenter"
      @mouseleave="handlers.mouseleave"
    >
      <div
        v-if="selectedRect"
        class="selection"
        :style="{ transform: `translateX(${selectedRect.left}px)`, width: `${selectedRect.width}px` }"
      />
      <!-- Slides between tabs as the hover does; concentric with the selection's
           flared corners, so a hovered neighbour's edge runs parallel to them. -->
      <FluidHoverHighlight :hover="hover" :hidden="hoveredIndex === activeIndex" class="rounded-[8px_8px_5px_5px]" />
      <AnimatePresence :initial="false">
        <TabItem
          v-for="(tab, i) in tabsState.tabs"
          :key="tab.id"
          :tab="tab"
          :index="i"
          :active="tab.id === activeTabId"
          :is-only="tabsState.tabs.length === 1"
          :is-last="i === tabsState.tabs.length - 1"
          :fluid-item="hover.itemDirective"
        />
      </AnimatePresence>
    </motion.div>
    <IconButton :label="t('tabs.newTabShortcut')" icon="i-mingcute-add-line" @click="newTab" />
  </div>
</template>

<style scoped>
/* The selected tab's sheet, sliding between tabs: in the page's color and
   open at the bottom, so it runs into the page, its foot flared out by two
   concave corners. Level with the tabs at the top, it reaches 3px further
   down, to the page. A CSS transition, not a JS spring: a tab switch renders
   the new grid on the main thread, stalling JS animation, while WebKit runs
   this on the compositor. */
.selection {
  position: absolute;
  left: 0;
  bottom: 0;
  pointer-events: none;
  height: 31px;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  background-color: var(--ps-background);
  transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
}

.selection::before,
.selection::after {
  content: '';
  position: absolute;
  bottom: 0;
  width: 8px;
  height: 8px;
}

.selection::before {
  left: -8px;
  background-image: radial-gradient(circle at 0 0, transparent 7.5px, var(--ps-background) 8px);
}

.selection::after {
  right: -8px;
  background-image: radial-gradient(circle at 100% 0, transparent 7.5px, var(--ps-background) 8px);
}
</style>
