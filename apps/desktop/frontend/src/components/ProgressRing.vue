<script setup lang="ts">
import { motion } from 'motion-v'
import { computed } from 'vue'
import { spring } from '~/lib/springs'

const { value, max = 100, size = 16 } = defineProps<{
  label: string
  value: number
  max?: number
  /** Diameter in px. */
  size?: number
}>()

const STROKE = 2

const ratio = computed(() => (max > 0 ? Math.min(1, Math.max(0, value / max)) : 0))
const r = computed(() => (size - STROKE) / 2)
</script>

<!-- A small determinate ring, filling clockwise from the top. Like ProgressBar, the fill moves on a spring. -->
<template>
  <svg
    role="progressbar"
    :aria-label="label"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="value"
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="shrink-0 -rotate-90"
  >
    <circle :cx="size / 2" :cy="size / 2" :r="r" :stroke-width="STROKE" class="fill-none stroke-active" />
    <motion.circle
      :cx="size / 2"
      :cy="size / 2"
      :r="r"
      :stroke-width="STROKE"
      stroke-linecap="round"
      class="fill-none stroke-foreground"
      :initial="false"
      :animate="{ pathLength: ratio }"
      :transition="spring.moderate"
    />
  </svg>
</template>
