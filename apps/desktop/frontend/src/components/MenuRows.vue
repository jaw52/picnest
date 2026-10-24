<script setup lang="ts">
import type { MenuItem } from '~/types/menu'
import { DropdownMenuItem } from 'reka-ui'
import { useTemplateRef } from 'vue'
import { useFluidHover } from '~/composables/useFluidHover'
import { useSize } from '~/context/size'
import FluidHoverHighlight from './FluidHoverHighlight.vue'

defineProps<{ items: MenuItem[] }>()

const size = useSize()
const container = useTemplateRef<HTMLElement>('container')
const hover = useFluidHover(container)
const { activeIndex, handlers } = hover
const vFluidItem = hover.itemDirective

// Keyboard navigation moves the hover background only; in a menu the
// highlighted row is the focus indicator.
function onFocusIn(e: FocusEvent) {
  const indexAttr = (e.target as HTMLElement).closest<HTMLElement>('[data-fluid-hover-index]')?.dataset.fluidHoverIndex
  if (indexAttr !== undefined)
    activeIndex.value = Number(indexAttr)
}

function onFocusOut(e: FocusEvent) {
  if (!container.value?.contains(e.relatedTarget as Node | null))
    activeIndex.value = null
}
</script>

<!--
  The rows every menu shows, with fluid hover. Reka's menu item is the same
  under a context menu and a dropdown, so both use these. The rows' box is
  their offsetParent, so the hover highlight measures from its corner.
-->
<template>
  <div
    ref="container"
    class="flex flex-col gap-0.5 relative"
    @mousemove="handlers.mousemove"
    @mouseenter="handlers.mouseenter"
    @mouseleave="handlers.mouseleave"
    @click="handlers.click"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <FluidHoverHighlight :hover="hover" class="rounded-item" />
    <DropdownMenuItem
      v-for="(item, index) in items"
      :key="item.id ?? item.label"
      v-fluid-item="index"
      :text-value="item.label"
      :disabled="item.disabled"
      :data-fluid-hover-index="index"
      :aria-label="item.label"
      class="row"
      :class="[size.control, size.gap, size.itemPx, { 'pointer-events-none opacity-50': item.disabled }]"
      @select="item.onSelect"
    >
      <!-- The tone goes on a wrapper: an icon's own color is currentColor. -->
      <span
        v-if="item.icon"
        class="tone flex shrink-0"
        :class="item.destructive ? 'text-destructive' : (activeIndex === index ? 'text-foreground' : 'text-muted-foreground')"
      >
        <span :class="[item.icon, size.icon]" />
      </span>
      <span class="grow inline-grid" :class="size.text">
        <span aria-hidden="true" class="stack-cell invisible wght-semibold trim-cap">{{ item.label }}</span>
        <span
          class="tone stack-cell wght-normal trim-cap"
          :class="item.destructive ? 'text-destructive' : (activeIndex === index ? 'text-foreground' : 'text-muted-foreground')"
        >{{ item.label }}</span>
      </span>
      <span v-if="item.shortcut" class="text-muted-foreground shrink-0 trim-cap" :class="size.text">{{ item.shortcut }}</span>
    </DropdownMenuItem>
  </div>
</template>

<style scoped>
/* Fixed height so the text-box trim on the label doesn't shrink the row;
   shrink-0 because the popup is a max-height flex column. */
.row {
  position: relative;
  z-index: 10;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  cursor: pointer;
  outline: none;
  border-radius: 8px;
}

.tone {
  transition:
    color 80ms,
    font-variation-settings 80ms;
}
</style>
