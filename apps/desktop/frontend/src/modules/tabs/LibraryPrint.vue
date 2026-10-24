<script setup lang="ts">
import type { MotionValue } from 'motion-v'
import { motion, useTransform } from 'motion-v'
import { computed } from 'vue'
import { FAN, PLACEHOLDERS, PRINT, PRINT_X, PRINT_Y } from './libraryGeometry'

const { index, spread, id } = defineProps<{
  index: number
  /** How far the prints are fanned out, 0 closed to 1 open. */
  spread: MotionValue<number>
  coverUrl: string | undefined
  /** The icon's id, which the print's own ids build on. */
  id: string
}>()

const fan = FAN[index]
const rotate = useTransform(spread, s => fan.rotate[0] + (fan.rotate[1] - fan.rotate[0]) * s)
const x = useTransform(spread, s => fan.x[0] + (fan.x[1] - fan.x[0]) * s)
const y = useTransform(spread, s => fan.y[0] + (fan.y[1] - fan.y[0]) * s)
const inner = {
  x: PRINT_X + PRINT.border,
  y: PRINT_Y + PRINT.border,
  width: PRINT.width - PRINT.border * 2,
  height: PRINT.height - PRINT.border * 2,
}
const placeholder = PLACEHOLDERS[index]
const clip = computed(() => `${id}clip${index}`)
const sky = computed(() => `${id}sky${index}`)
// The horizon sits a little below the middle; the sun above the hills.
const horizon = inner.y + inner.height * 0.62
const hills = [
  `M ${inner.x} ${horizon + 6}`,
  `L ${inner.x + inner.width * 0.3} ${horizon - 10}`,
  `L ${inner.x + inner.width * 0.5} ${horizon}`,
  `L ${inner.x + inner.width * 0.68} ${horizon - 6}`,
  `L ${inner.x + inner.width} ${horizon + 4}`,
  `V ${inner.y + inner.height} H ${inner.x} Z`,
].join(' ')
</script>

<!-- One white-bordered print, turning about its bottom edge like a card held in a hand. -->
<template>
  <motion.g :style="{ rotate, x, y, originX: 0.5, originY: 1 }">
    <defs>
      <clipPath :id="clip">
        <rect v-bind="inner" :rx="PRINT.radius - PRINT.border" />
      </clipPath>
      <linearGradient :id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="placeholder.sky[0]" />
        <stop offset="1" :stop-color="placeholder.sky[1]" />
      </linearGradient>
    </defs>
    <rect :x="PRINT_X" :y="PRINT_Y" :width="PRINT.width" :height="PRINT.height" :rx="PRINT.radius" fill="#fff" :filter="`url(#${id}shadow)`" />
    <g :clip-path="`url(#${clip})`">
      <image v-if="coverUrl" :href="coverUrl" v-bind="inner" preserveAspectRatio="xMidYMid slice" />
      <template v-else>
        <rect v-bind="inner" :fill="`url(#${sky})`" />
        <circle :cx="inner.x + inner.width * 0.72" :cy="inner.y + inner.height * 0.3" :r="4.5" fill="#fff" :fill-opacity="0.85" />
        <path :d="hills" :fill="placeholder.hill" :fill-opacity="0.8" />
      </template>
    </g>
  </motion.g>
</template>
