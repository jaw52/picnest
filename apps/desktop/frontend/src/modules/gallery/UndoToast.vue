<script setup lang="ts">
import type { UndoableDeletion } from '~/types/gallery'
import { AnimatePresence, motion } from 'motion-v'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppTooltip from '~/components/AppTooltip.vue'
import BaseButton from '~/components/BaseButton.vue'
import { useUndoDeletion } from '~/composables/useDeletePhoto'
import { spring } from '~/lib/springs'
import { useGallery } from '~/state/gallery'

/** How long the toast stays up, unless the pointer rests on it. */
const VISIBLE_MS = 6000

const { t } = useI18n()
const { undoableDeletion } = useGallery()
const undo = useUndoDeletion()
const shown = shallowRef<UndoableDeletion | null>(undoableDeletion.value)
const hovered = shallowRef(false)

// Each new deletion shows the toast afresh; undoing hides it.
watch(undoableDeletion, (deletion) => {
  shown.value = deletion
})

watch([shown, hovered], ([deletion, resting], _, onCleanup) => {
  if (!deletion || resting)
    return
  const timer = window.setTimeout(() => {
    shown.value = null
  }, VISIBLE_MS)
  onCleanup(() => window.clearTimeout(timer))
})

const count = computed(() => shown.value?.trashed.length ?? 0)
</script>

<!-- "Moved to the trash · Undo", for a few seconds after a deletion. ⌘Z undoes it too, for as long as it is the last deletion (see useUndoShortcut). -->
<template>
  <AnimatePresence>
    <motion.div
      v-if="shown"
      role="status"
      class="toast text-caption"
      :initial="{ opacity: 0, x: '-50%', y: 8 }"
      :animate="{ opacity: 1, x: '-50%', y: 0 }"
      :exit="{ opacity: 0, x: '-50%', y: 8, transition: spring.moderate.exit }"
      :transition="spring.moderate"
      @pointerenter="hovered = true"
      @pointerleave="hovered = false"
    >
      <span>{{ count > 1 ? t('gallery.trashedMany', { count }) : t('gallery.trashedOne') }}</span>
      <AppTooltip content="⌘Z">
        <BaseButton variant="secondary" size="compact" @click="undo">
          {{ t('gallery.undo') }}
        </BaseButton>
      </AppTooltip>
    </motion.div>
  </AnimatePresence>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  background-color: var(--ps-surface-5);
  box-shadow: var(--ps-shadow-5);
  padding: 6px 6px 6px 14px;
  color: var(--ps-foreground);
  white-space: nowrap;
}
</style>
