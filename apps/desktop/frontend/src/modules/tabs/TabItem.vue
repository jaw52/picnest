<script setup lang="ts">
import type { ObjectDirective } from 'vue'
import type { MenuItem } from '~/types/menu'
import type { Tab } from '~/types/tabs'
import { motion } from 'motion-v'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ContextMenu from '~/components/ContextMenu.vue'
import { useIsICloudFolder } from '~/composables/useIsICloudFolder'
import { folderNameFromPath } from '~/lib/folders'
import { isLibraryPath } from '~/lib/library'
import { spring } from '~/lib/springs'
import { activateTab, closeOtherTabs, closeTab, closeTabsToRight } from '~/state/tabs'
import { pathMenuItems } from './pathMenuItems'

const { tab, index, active, isOnly, isLast, fluidItem } = defineProps<{
  tab: Tab
  index: number
  active: boolean
  isOnly: boolean
  isLast: boolean
  /** Registers the tab with the strip's hover. */
  fluidItem: ObjectDirective<HTMLElement, number>
}>()

const vFluidItem = fluidItem
const { t } = useI18n()

const title = computed(() => {
  if (tab.path === null)
    return t('common.newTab')
  return isLibraryPath(tab.path) ? t('library.name') : folderNameFromPath(tab.path)
})

/**
 * The new-tab page's grid, the Photos library, or where a folder lives:
 * iCloud Drive or this Mac. Until that is known, an empty space the icon's
 * size, so the title doesn't shift when it arrives.
 */
const iCloud = useIsICloudFolder(() => tab.path)
const icon = computed(() => {
  const [line, fill] = (() => {
    if (tab.path === null)
      return ['i-mingcute-layout-grid-line', 'i-mingcute-layout-grid-fill']
    if (isLibraryPath(tab.path))
      return ['i-mingcute-pic-line', 'i-mingcute-pic-fill']
    if (iCloud.value === undefined)
      return ['', '']
    return iCloud.value
      ? ['i-mingcute-cloud-line', 'i-mingcute-cloud-fill']
      : ['i-mingcute-folder-line', 'i-mingcute-folder-fill']
  })()
  return active ? fill : line
})

const menuItems = computed<MenuItem[]>(() => [
  { label: t('common.close'), icon: 'i-mingcute-close-line', shortcut: active ? '⌘W' : undefined, onSelect: () => closeTab(tab.id) },
  { label: t('tabs.closeOthers'), icon: 'i-mingcute-close-square-line', disabled: isOnly, onSelect: () => closeOtherTabs(tab.id) },
  { label: t('tabs.closeToRight'), icon: 'i-mingcute-align-arrow-right-line', disabled: isLast, onSelect: () => closeTabsToRight(tab.id) },
  // The Photos library has no path in Finder.
  ...(tab.path && !isLibraryPath(tab.path) ? pathMenuItems(tab.path) : []),
])

function onMouseDown(e: MouseEvent) {
  // Middle click closes, like a browser.
  if (e.button === 1) {
    e.preventDefault()
    closeTab(tab.id)
  }
  else if (e.button === 0) {
    activateTab(tab.id)
  }
}
</script>

<!-- A tab in the strip. A closed one leaves its slot as it starts fading out, so it never clears its successor's. -->
<template>
  <motion.div
    v-fluid-item="index"
    layout="position"
    role="tab"
    :data-fluid-hover-index="index"
    :aria-selected="active"
    class="group/tab text-caption tab"
    :class="active ? 'text-foreground' : 'text-muted-foreground'"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :exit="{ opacity: 0, transition: spring.moderate.exit }"
    :transition="spring.moderate"
    @mousedown="onMouseDown"
  >
    <ContextMenu :items="menuItems" trigger-class="h-full min-w-0 flex grow items-center gap-1.5 pl-2.5 pr-1">
      <span class="shrink-0 size-3.5" :class="icon" />
      <span class="flex-1 min-w-0 truncate" :class="active ? 'wght-semibold' : 'wght-normal'">{{ title }}</span>
      <!-- Only the active tab and the hovered one offer their close button. -->
      <button
        type="button"
        class="close"
        :class="{ shown: active }"
        :aria-label="t('tabs.closeTab', { title })"
        @mousedown.stop
        @click="closeTab(tab.id)"
      >
        <span class="i-mingcute-close-line size-3" />
      </button>
    </ContextMenu>
  </motion.div>
</template>

<style scoped>
/* Tabs share the row evenly and shrink together, like a browser's; centered
   on the active tab, which reaches down to the page. */
.tab {
  position: relative;
  display: flex;
  width: 180px;
  min-width: 72px;
  flex-shrink: 1;
  height: 28px;
  margin-bottom: 3px;
  cursor: default;
  transition: color 80ms;
}

.close {
  display: flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  background-color: transparent;
  color: var(--ps-muted-foreground);
  transition:
    opacity 80ms,
    color 80ms,
    background-color 80ms;
}

.tab:hover .close,
.close.shown {
  opacity: 1;
}

.close:hover {
  background-color: var(--ps-hover);
  color: var(--ps-foreground);
}
</style>
