<script setup lang="ts">
import type { CollectItem as Item } from '~/mygo'
import { onScopeDispose, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { events, App as GoApp } from '~/mygo'
import CollectItem from './CollectItem.vue'
import SaveTarget from './SaveTarget.vue'

const { t } = useI18n()
const items = shallowRef<Item[]>([])
const over = shallowRef(false)

void GoApp.collectedItems().then((collected) => {
  items.value = collected
})
const offItems = events.collectChanged.on((collected) => {
  items.value = collected
})
const offHover = events.collectHover.on((hovering) => {
  over.value = hovering
})
onScopeDispose(() => {
  offItems()
  offHover()
})
</script>

<!--
  The panel under the menu bar icon: where a picture dragged from a web page
  is dropped to be collected, and the pictures dropped so far. The Go side
  takes the drop itself (see collect_darwin.go) and says when one is over.
-->
<template>
  <div class="text-foreground p-3 rounded-container bg-background flex flex-col gap-3 h-screen overflow-hidden">
    <div class="drop-zone" :class="{ over }">
      <span class="i-mingcute-download-2-line size-6" />
      <span class="text-caption wght-semibold">{{ over ? t('collect.release') : t('collect.dropHere') }}</span>
    </div>
    <div class="flex grow flex-col gap-0.5 min-h-0 overflow-y-auto -mx-1">
      <CollectItem v-for="item in items" :key="item.id" :item="item" />
    </div>
    <SaveTarget />
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  height: 112px;
  border: 1.5px dashed var(--ps-border);
  border-radius: 8px;
  color: var(--ps-muted-foreground);
  transition-property: border-color, background-color, color, transform;
  transition-duration: 160ms;
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}

.drop-zone.over {
  border-style: solid;
  border-color: var(--ps-info);
  background-color: color-mix(in srgb, var(--ps-info) 10%, transparent);
  color: var(--ps-info);
  transform: scale(1.02);
}
</style>
