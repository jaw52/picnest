<script setup lang="ts">
import type { Placeholder } from '~/types/lightbox'
import { computed } from 'vue'

const { placeholder } = defineProps<{ placeholder: Placeholder }>()

// The photo's fitted box, worked out from its size since the placeholder
// has too few pixels to set it: no larger than the photo, nor than the room
// the image style leaves it.
const box = computed(() => ({
  width: `min(${placeholder.width}px, calc(100vw - 128px), calc((100vh - 152px) * ${placeholder.width / placeholder.height}))`,
  aspectRatio: `${placeholder.width} / ${placeholder.height}`,
}))
</script>

<!-- The placeholder, as large as the photo will show: its own pixels are far fewer. The photo goes over it, filling the same box. -->
<template>
  <img :src="placeholder.src" alt="" draggable="false" class="lb-image" :style="box">
</template>
