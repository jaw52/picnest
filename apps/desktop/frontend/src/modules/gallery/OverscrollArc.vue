<script setup lang="ts">
import type { MotionValue } from 'motion-v'
import { motion, useTransform } from 'motion-v'
import { PULL_MAX } from '~/composables/useBottomPull'

const { pull } = defineProps<{ pull: MotionValue<number> }>()

/**
 * The arc from one bottom corner to the other, bulging up by `pull` px:
 * a quadratic curve peaks halfway to its control point.
 */
function arcPath(p: number) {
  const width = window.innerWidth
  return `M 0 ${PULL_MAX} Q ${width / 2} ${PULL_MAX - p * 2} ${width} ${PULL_MAX}`
}

const clipPath = useTransform(pull, p => `path('${arcPath(p)} Z')`)
const opacity = useTransform(pull, [0, PULL_MAX * 0.25], [0, 1])
</script>

<!--
  What scrolling on past the end of the grid shows: an arc rising from the
  bottom edge, bending further the harder it is pushed - after Android's
  edge glow.
-->
<template>
  <motion.div
    aria-hidden="true"
    class="arc"
    :style="{ 'height': `${PULL_MAX}px`, '--clip': clipPath, opacity }"
  />
</template>

<style scoped>
/* The page's gray a shade deeper, mostly opaque, so it stands out over any
   photo while still hinting at what is under it. */
.arc {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  pointer-events: none;
  background-color: color-mix(
    in srgb,
    color-mix(in oklab, var(--ps-foreground) 14%, var(--ps-background)) 65%,
    transparent
  );
  backdrop-filter: blur(8px);
  -webkit-clip-path: var(--clip);
  clip-path: var(--clip);
}
</style>
