<script setup lang="ts">
import type { MenuItem } from '~/types/menu'
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'
import { surfaceClasses, useSurface } from '~/context/surface'
import MenuRows from './MenuRows.vue'

const { triggerClass = 'contents' } = defineProps<{
  items: MenuItem[]
  /**
   * The box right-clicks open the menu from. By default it adds none: the
   * children lay out as if unwrapped while their right-clicks still reach it.
   */
  triggerClass?: string
}>()
const emit = defineEmits<{ openChange: [open: boolean] }>()

// A menu stacks two steps above whatever it opens over, so it never melts
// into a dialog or panel of the same color.
const surface = surfaceClasses(Math.min(useSurface() + 2, 8), 3)
</script>

<!-- Right-click menu: Reka's context menu with fluid-hover rows. -->
<template>
  <ContextMenuRoot @update:open="open => emit('openChange', open)">
    <ContextMenuTrigger as="div" :class="triggerClass">
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="menu-popup" :class="surface">
        <MenuRows :items="items" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
