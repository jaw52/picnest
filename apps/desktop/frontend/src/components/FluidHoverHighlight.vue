<script setup lang="ts">
import type { Transition } from 'motion-v'
import type { FluidHover } from '~/composables/useFluidHover'
import type { ItemRect } from '~/types/fluid-hover'
import { AnimatePresence, motion, useReducedMotion } from 'motion-v'
import { computed } from 'vue'
import { spring } from '~/lib/springs'

// Radius, z-index and the like are the consumer's, on the highlight itself.
defineOptions({ inheritAttrs: false })

const { hover, hidden = false, from, transition } = defineProps<{
  /** The list's hover. The highlight sits on its active row once measured, and re-keys on the session. */
  hover: Pick<FluidHover, 'activeIndex' | 'itemRects' | 'isMeasured' | 'session'>
  /** Keep the list's state but show nothing (a closed popup, hover switched off). Runs the exit fade. */
  hidden?: boolean
  /** Where a fresh session fades in from. Defaults to the rect itself. */
  from?: ItemRect | null
  /**
   * The positional spring. Defaults to `spring.fast`. Pass `false` to snap
   * to the new rect with no travel. The opacity fade is always 0.08s.
   */
  transition?: Transition | false
}>()

const FADE: Transition = { duration: 0.08 }
const SNAP: Transition = { duration: 0 }

/** A measured rect as animation targets: position as a transform, size as layout. */
function toTarget(rect: ItemRect) {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

const rect = computed(() => {
  const index = hover.activeIndex.value
  return !hidden && hover.isMeasured.value && index !== null ? hover.itemRects.value[index] ?? null : null
})

// Reduced motion keeps the opacity fade and drops the travel: fewer and
// gentler, not none.
const reduceMotion = useReducedMotion()
const resolvedTransition = computed<Transition>(() => ({
  ...(transition === false || reduceMotion.value ? SNAP : (transition ?? spring.fast)),
  opacity: FADE,
}))
</script>

<!--
  The hover highlight every fluid hover list renders: an absolutely
  positioned fill that springs between the rects useFluidHover measures,
  pinned to the container's padding corner and moved with a transform, so the
  travel runs on the compositor. The container must be `relative`.
-->
<template>
  <AnimatePresence>
    <motion.div
      v-if="rect"
      :key="hover.session.value"
      v-bind="$attrs"
      data-slot="fluid-hover-highlight"
      class="bg-hover pointer-events-none left-0 top-0 absolute"
      :initial="{ opacity: 0, ...toTarget(from ?? rect) }"
      :animate="{ opacity: 1, ...toTarget(rect) }"
      :exit="{ opacity: 0, transition: spring.fast.exit }"
      :transition="resolvedTransition"
    />
  </AnimatePresence>
</template>
