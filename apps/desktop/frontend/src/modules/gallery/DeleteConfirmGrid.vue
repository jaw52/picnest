<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useResizeObserver } from '@vueuse/core'
import { AnimatePresence, motion } from 'motion-v'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { cellsInRange, layoutMasonry } from '~/lib/masonry'
import { spring } from '~/lib/springs'
import DeleteConfirmTile from './DeleteConfirmTile.vue'

const { photos } = defineProps<{ photos: Photo[], folderPath: string }>()
const emit = defineEmits<{ remove: [photo: Photo] }>()

const MIN_COLUMN_WIDTH = 140
const GUTTER = 8

const { t } = useI18n()
const scroller = useTemplateRef<HTMLElement>('scroller')
const width = shallowRef(0)
const viewport = shallowRef({ top: 0, height: 0 })
useResizeObserver(scroller, ([entry]) => {
  width.value = entry.contentRect.width
  const el = scroller.value
  if (el)
    viewport.value = { top: el.scrollTop, height: el.clientHeight }
})

const layout = computed(() => layoutMasonry(photos.map(p => p.aspectRatio), width.value, MIN_COLUMN_WIDTH, GUTTER))
// A screen above and below the visible part stays mounted, as in the main grid.
const visible = computed(() => (width.value > 0
  ? cellsInRange(layout.value.cells, viewport.value.top - viewport.value.height, viewport.value.top + viewport.value.height * 2)
      .map(i => ({ photo: photos[i], cell: layout.value.cells[i] }))
  : []))

function onScroll(e: Event) {
  const el = e.currentTarget as HTMLElement
  viewport.value = { top: el.scrollTop, height: el.clientHeight }
}
</script>

<!-- The photos still marked for deletion, as a scrollable, windowed masonry grid; it scrolls on its own, so the header and buttons stay put. -->
<template>
  <div ref="scroller" class="px-5 py-1 grow min-h-40 overflow-y-auto" @scroll="onScroll">
    <div v-if="photos.length === 0" class="text-body text-muted-foreground flex h-40 items-center justify-center">
      {{ t('deleteConfirm.nothingLeft') }}
    </div>
    <div v-else class="relative" :style="{ height: `${layout.height}px` }">
      <!-- Tiles glide into the gaps left by removed ones. -->
      <AnimatePresence :initial="false">
        <motion.div
          v-for="{ photo, cell } in visible"
          :key="photo.id"
          class="left-0 top-0 absolute"
          :initial="{ opacity: 0, scale: 0.96, x: cell.left, y: cell.top }"
          :animate="{ opacity: 1, scale: 1, x: cell.left, y: cell.top }"
          :exit="{ opacity: 0, scale: 0.96, transition: spring.moderate.exit }"
          :transition="spring.moderate"
        >
          <DeleteConfirmTile
            :photo="photo"
            :folder-path="folderPath"
            :width="layout.columnWidth"
            :height="cell.height"
            @remove="emit('remove', photo)"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  </div>
</template>
