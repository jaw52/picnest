<script setup lang="ts">
import type { MenuItem } from '~/types/menu'
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { surfaceClasses, useSurface } from '~/context/surface'
import MenuRows from './MenuRows.vue'

defineProps<{ items: MenuItem[] }>()
const emit = defineEmits<{ openChange: [open: boolean] }>()

const surface = surfaceClasses(Math.min(useSurface() + 2, 8), 3)
</script>

<!-- Click-to-open menu, with the same rows as ContextMenu, anchored below its trigger (the default slot). -->
<template>
  <DropdownMenuRoot :modal="false" @update:open="open => emit('openChange', open)">
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent :side-offset="4" align="start" class="menu-popup" :class="surface">
        <MenuRows :items="items" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
