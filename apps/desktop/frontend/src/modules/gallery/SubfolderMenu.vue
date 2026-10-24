<script setup lang="ts">
import type { FolderEntry } from '~/types/folder'
import type { MenuItem } from '~/types/menu'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DropdownMenu from '~/components/DropdownMenu.vue'
import { listSubfolders } from '~/lib/backend'
import { folderNameFromPath } from '~/lib/folders'
import { openInActiveTab } from '~/state/tabs'

const { folder } = defineProps<{ folder: string }>()

const { t } = useI18n()
const subfolders = shallowRef<FolderEntry[]>([])
// Bumped on every open, so folders created since show up.
const version = shallowRef(0)

watch([() => folder, version], ([path], _, onCleanup) => {
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  listSubfolders(path)
    .then((entries) => {
      if (!cancelled)
        subfolders.value = entries
    })
    .catch((error: unknown) => {
      console.warn(`failed to list subfolders of ${path}:`, error)
      if (!cancelled)
        subfolders.value = []
    })
}, { immediate: true })

const items = computed<MenuItem[]>(() => subfolders.value.map(entry => ({
  label: entry.name,
  icon: 'i-mingcute-folder-line',
  onSelect: () => openInActiveTab(entry.path),
})))
</script>

<!-- A chevron between two folders of the path that drops down the first one's subfolders, to jump to a sibling of the folder after it. -->
<template>
  <DropdownMenu :items="items" @open-change="open => open && version++">
    <button type="button" class="chevron" :aria-label="t('path.subfolders', { name: folderNameFromPath(folder) })">
      <span class="i-mingcute-right-line size-3.5" />
    </button>
  </DropdownMenu>
</template>

<style scoped>
.chevron {
  display: flex;
  width: 20px;
  height: 24px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 8px;
  cursor: pointer;
  color: var(--ps-muted-foreground);
  background-color: transparent;
  transition:
    color 80ms,
    background-color 80ms;
}

.chevron:hover {
  color: var(--ps-foreground);
  background-color: var(--ps-hover);
}

.chevron[data-state='open'] {
  background-color: var(--ps-active);
}
</style>
