<script setup lang="ts">
import { motion } from 'motion-v'
import { computed } from 'vue'
import { spring } from '~/lib/springs'

const { value, max = 100, tone = 'default', thin = false } = defineProps<{
  label: string
  value: number
  max?: number
  tone?: 'default' | 'error'
  /** A hairline across a bar, square-ended. */
  thin?: boolean
}>()

const ratio = computed(() => (max > 0 ? Math.min(1, Math.max(0, value / max)) : 0))
</script>

<!--
  A thin determinate bar. The fill scales on a spring rather than animating
  its width, so it stays on the compositor.
-->
<template>
  <div
    role="progressbar"
    :aria-label="label"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="value"
    class="bg-active overflow-hidden"
    :class="thin ? 'h-0.5' : 'h-1 rounded-full'"
  >
    <motion.div
      class="h-full origin-left"
      :class="tone === 'error' ? 'bg-destructive' : 'bg-foreground'"
      :initial="false"
      :animate="{ scaleX: ratio }"
      :transition="spring.moderate"
    />
  </div>
</template>
