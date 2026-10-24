<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useSize } from '~/context/size'
import { useTabsSubtle } from './tabsSubtle'

const { label, index, dimmed = false } = defineProps<{
  label: string
  index: number
  /** Fades the label while neither hovered nor selected, e.g. for a filter that would show nothing. */
  dimmed?: boolean
}>()

const size = useSize()
const { tabDirective: vFluidItem, hoveredIndex, selectedIndex } = useTabsSubtle()

const isSelected = computed(() => selectedIndex() === index)
const isActive = computed(() => hoveredIndex.value === index || isSelected.value)
</script>

<template>
  <TabsTrigger
    v-fluid-item="index"
    :value="index"
    :data-fluid-hover-index="index"
    class="tab"
    :class="[size.control, size.px, size.gap]"
  >
    <span class="inline-grid whitespace-nowrap tabular-nums" :class="size.text">
      <span aria-hidden="true" class="stack-cell invisible wght-semibold trim-cap">{{ label }}</span>
      <span
        class="label stack-cell trim-cap"
        :class="[
          isActive ? 'text-foreground' : 'text-muted-foreground',
          { 'opacity-45': dimmed && !isActive },
          isSelected ? 'wght-semibold' : 'wght-normal',
        ]"
      >{{ label }}</span>
    </span>
  </TabsTrigger>
</template>

<style scoped>
/* Fixed heights, so the text-box trim on the label doesn't shrink the tab. */
.tab {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  cursor: pointer;
  background-color: transparent;
  outline: none;
  border-radius: 8px;
}

.label {
  transition:
    color 80ms,
    font-variation-settings 80ms;
}
</style>
