<script setup lang="ts">
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion-v'
import { useId, watch } from 'vue'
import { spring } from '~/lib/springs'
import { BACK_PATH, cloudOnFront, FRONT_HIGH_CLOSED, FRONT_HIGH_OPEN, frontPath, frontTopEdge, H, PHOTO, W } from './folderGeometry'

const { coverUrl, open, iCloud = false, fluid = false } = defineProps<{
  coverUrl: string | undefined
  open: boolean
  iCloud?: boolean
  /** In a tile the icon scales with the column instead. */
  fluid?: boolean
}>()

// One value drives the front's height; its outline, highlight and the glass
// clip are all rebuilt from it each frame, so they move as one.
const high = useMotionValue(FRONT_HIGH_CLOSED)
const front = useTransform(high, frontPath)
const topEdge = useTransform(high, frontTopEdge)
const cloud = useTransform(high, h => cloudOnFront(h))
const cloudEdge = useTransform(high, h => cloudOnFront(h, 0.5))
const reduceMotion = useReducedMotion()
watch(() => open, (isOpen, _, onCleanup) => {
  const target = isOpen ? FRONT_HIGH_OPEN : FRONT_HIGH_CLOSED
  if (reduceMotion.value) {
    high.set(target)
    return
  }
  const controls = animate(high, target, spring.slow)
  onCleanup(() => controls.stop())
})

// Gradients, clips and filters are looked up by document-wide id, inside
// url(#...) references - keep only characters that are safe there.
const id = `folder${useId().replaceAll(/[^\w-]/g, '')}`
const inner = {
  x: PHOTO.x + PHOTO.border,
  y: PHOTO.y + PHOTO.border,
  width: PHOTO.width - PHOTO.border * 2,
  height: PHOTO.height - PHOTO.border * 2,
}
</script>

<!--
  A Finder-style folder drawn in SVG: the back, the cover photo peeking out,
  and a frosted front - the photo blurred and clipped to the front's shape
  under a translucent blue, which is what Finder's glass looks like.
-->
<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="block" :class="fluid ? 'h-auto w-full' : 'h-[84px] w-[104px]'">
    <defs>
      <linearGradient :id="`${id}back`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5fb5f4" />
        <stop offset="1" stop-color="#3f9de9" />
      </linearGradient>
      <linearGradient :id="`${id}front`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9fd3fb" :stop-opacity="coverUrl ? 0.55 : 1" />
        <stop offset="1" stop-color="#6fbaf5" :stop-opacity="coverUrl ? 0.75 : 1" />
      </linearGradient>
      <clipPath :id="`${id}photo`">
        <rect v-bind="inner" :rx="PHOTO.radius - PHOTO.border" />
      </clipPath>
      <clipPath :id="`${id}frontClip`">
        <motion.path :d="front" />
      </clipPath>
      <filter :id="`${id}blur`" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter :id="`${id}shadow`" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="0.5" stdDeviation="0.75" flood-opacity="0.25" />
      </filter>
    </defs>

    <path :d="BACK_PATH" :fill="`url(#${id}back)`" />

    <template v-if="coverUrl">
      <rect :x="PHOTO.x" :y="PHOTO.y" :width="PHOTO.width" :height="PHOTO.height" :rx="PHOTO.radius" fill="#fff" :filter="`url(#${id}shadow)`" />
      <image :href="coverUrl" v-bind="inner" preserveAspectRatio="xMidYMid slice" :clip-path="`url(#${id}photo)`" />
      <!-- The frosted glass: the same framed photo, blurred, seen through the front. -->
      <g :clip-path="`url(#${id}frontClip)`">
        <g :filter="`url(#${id}blur)`">
          <rect :x="PHOTO.x" :y="PHOTO.y" :width="PHOTO.width" :height="PHOTO.height" :rx="PHOTO.radius" fill="#fff" />
          <image :href="coverUrl" v-bind="inner" preserveAspectRatio="xMidYMid slice" :clip-path="`url(#${id}photo)`" />
        </g>
      </g>
    </template>

    <motion.path :d="front" :fill="`url(#${id}front)`" />
    <!-- A highlight along the front's top edge. -->
    <motion.path :d="topEdge" fill="none" stroke="#fff" :stroke-opacity="0.6" :stroke-width="1" :clip-path="`url(#${id}frontClip)`" />
    <!-- Pressed in: a darker cloud over a light edge just below it. -->
    <template v-if="iCloud">
      <motion.path :d="cloudEdge" fill="#fff" :fill-opacity="0.5" />
      <motion.path :d="cloud" fill="#1f6fbf" :fill-opacity="0.55" />
    </template>
  </svg>
</template>
