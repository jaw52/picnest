<script setup lang="ts">
import type { Tab } from '~/types/tabs'
import { AnimatePresence, motion } from 'motion-v'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsEvents } from '~/composables/useSettingsEvents'
import { useFolderDrop, useTabShortcuts } from '~/composables/useTabShortcuts'
import { useSize } from '~/context/size'
import { spring } from '~/lib/springs'
import Toolbar from '~/modules/gallery/Toolbar.vue'
import SettingsDialog from '~/modules/settings/SettingsDialog.vue'
import TabPane from '~/modules/tabs/TabPane.vue'
import { activeTabId, tabsState } from '~/state/tabs'

/**
 * How many tabs keep their gallery while others are shown: the ones used
 * last. Each holds its photos' list and decoded thumbnails; one left out
 * loads its folder again when it is switched back to.
 */
const KEPT_TABS = 5

const { t } = useI18n()
useSettingsEvents()
useTabShortcuts()
const isDraggingOver = useFolderDrop()
const size = useSize()

/** The tabs used last, the active one first. */
const used = shallowRef<string[]>([activeTabId.value])
// Kept in step before rendering, so a tab switched to mounts at once.
watch(activeTabId, (activeId) => {
  used.value = [activeId, ...used.value.filter(id => id !== activeId)]
}, { flush: 'sync' })

/**
 * The tabs that keep their gallery: the active one and those used last
 * before it, up to KEPT_TABS, in the tabs' order.
 */
const kept = computed<Tab[]>(() => {
  const { tabs } = tabsState.value
  const open = new Set(tabs.map(tab => tab.id))
  const keep = new Set([activeTabId.value, ...used.value.filter(id => open.has(id))].slice(0, KEPT_TABS))
  return tabs.filter(tab => keep.has(tab.id))
})
</script>

<template>
  <div class="text-foreground bg-background flex flex-col h-screen">
    <!-- The tab bar doubles as a drag handle, like a native app's title bar -
         clicking a tab or button still works, only click+drag on empty space
         moves the window. Toolbar marks itself with data-drag-region (see
         theme/theme.css). -->
    <Toolbar />
    <!-- The tabs' pages, each scrolling on its own (see TabPane). -->
    <div class="grow min-h-0 relative">
      <TabPane v-for="tab in kept" :key="tab.id" :tab="tab" :active="tab.id === activeTabId" />
    </div>
    <SettingsDialog />
    <AnimatePresence>
      <motion.div
        v-if="isDraggingOver"
        class="drop-overlay wght-semibold"
        :class="size.text"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0, transition: spring.moderate.exit }"
        :transition="spring.moderate"
      >
        {{ t('app.dropToAddFolder') }}
      </motion.div>
    </AnimatePresence>
  </div>
</template>

<style scoped>
.drop-overlay {
  pointer-events: none;
  position: fixed;
  inset: 8px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--ps-focus-ring);
  border-radius: 12px;
  background-color: color-mix(in srgb, var(--ps-focus-ring) 10%, transparent);
  color: var(--ps-foreground);
}
</style>
