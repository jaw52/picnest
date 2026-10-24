<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

const { side = 'top', sideOffset = 8, delay } = defineProps<{
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  /** Hover delay before this tooltip opens, in ms. Defaults to the TooltipProvider's. */
  delay?: number
}>()
</script>

<template>
  <TooltipRoot :delay-duration="delay">
    <!-- The trigger: a single element that accepts a ref and event props. -->
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="sideOffset"
        class="tooltip text-caption text-background px-2 py-1 rounded-item bg-foreground z-50 wght-normal trim-cap"
      >
        {{ content }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
