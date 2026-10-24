<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useWindowSize } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { FILM_THUMB } from './filmstrip'
import FilmThumb from './FilmThumb.vue'

const { photos, index } = defineProps<{
  photos: Photo[]
  index: number
  folderPath: string | null
}>()
const emit = defineEmits<{ select: [index: number] }>()

const FILM_GAP = 6
const STEP = FILM_THUMB + FILM_GAP
/** Room above and below the thumbnails for the current one's ring. */
const RING_ROOM = 4
/** Thumbnails mounted past each edge of the strip. */
const OVERSCAN = 4

const strip = useTemplateRef<HTMLElement>('strip')
// The strip spans the window.
const { width } = useWindowSize()
// Scrolled to `i * STEP`, thumbnail i is in the middle.
const pad = computed(() => width.value / 2 - FILM_THUMB / 2)
const scrollLeft = shallowRef(index * STEP)

// The photo shown comes to the middle: at once when the lightbox opens,
// gliding after that.
let placed = false
watch([() => index, width, strip], ([current, , el]) => {
  if (!el)
    return
  const left = current * STEP
  if (placed && typeof el.scrollTo === 'function')
    el.scrollTo({ left, behavior: 'smooth' })
  else
    el.scrollLeft = left
  placed = true
}, { immediate: true, flush: 'post' })

const first = computed(() => Math.max(0, Math.floor((scrollLeft.value - pad.value) / STEP) - OVERSCAN))
const last = computed(() => Math.min(photos.length - 1, Math.ceil((scrollLeft.value - pad.value + width.value) / STEP) + OVERSCAN))
const shown = computed(() => photos.slice(first.value, last.value + 1).map((photo, i) => ({ photo, at: first.value + i })))

function onScroll(e: Event) {
  scrollLeft.value = (e.currentTarget as HTMLElement).scrollLeft
}

function onWheel(e: WheelEvent) {
  // A mouse wheel only turns down; along the strip is the way to go.
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX))
    (e.currentTarget as HTMLElement).scrollLeft += e.deltaY
}
</script>

<!--
  The lightbox's strip of thumbnails. It scrolls on its own, natively, to
  browse without changing the photo; clicking a thumbnail shows it, and
  whenever the photo changes the strip brings it to the middle. Only the
  thumbnails in view are mounted. Scrolling it is browsing it, not swiping
  the photo.
-->
<template>
  <div
    ref="strip"
    class="strip"
    :style="{ bottom: `${12 - RING_ROOM}px`, height: `${FILM_THUMB + 2 * RING_ROOM}px` }"
    role="presentation"
    @click.stop
    @scroll="onScroll"
    @wheel.stop="onWheel"
  >
    <!-- As wide as every thumbnail, with half the strip's width either end so the first and last can come to the middle. -->
    <div class="h-full relative" :style="{ width: `${2 * pad + (photos.length - 1) * STEP + FILM_THUMB}px` }">
      <!-- The lightbox's arrow keys move through these already. -->
      <button
        v-for="{ photo, at } in shown"
        :key="photo.id"
        type="button"
        class="thumb"
        :class="{ current: at === index }"
        :style="{ left: `${pad + at * STEP}px`, top: `${RING_ROOM}px`, width: `${FILM_THUMB}px`, height: `${FILM_THUMB}px` }"
        :aria-label="photo.fileName || undefined"
        :aria-current="at === index"
        tabindex="-1"
        @click="emit('select', at)"
      >
        <FilmThumb :photo="photo" :folder-path="folderPath" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.strip {
  position: absolute;
  inset-inline: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  overscroll-behavior: contain;
}

.thumb {
  position: absolute;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  border-radius: 0;
  background-color: rgb(255 255 255 / 0.08);
  opacity: 0.45;
  transition:
    opacity 200ms ease-out,
    box-shadow 200ms ease-out;
}

.thumb:hover {
  opacity: 0.8;
}

.thumb.current {
  opacity: 1;
  box-shadow: 0 0 0 2px white;
}
</style>
