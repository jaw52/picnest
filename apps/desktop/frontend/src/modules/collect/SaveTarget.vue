<script setup lang="ts">
import type { MenuItem } from '~/types/menu'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DropdownMenu from '~/components/DropdownMenu.vue'
import IconButton from '~/components/IconButton.vue'
import { openPath } from '~/lib/native'
import { App as GoApp } from '~/mygo'
import { recentFolders } from '~/state/recentFolders'

const { t } = useI18n()
// undefined until the Go side says; "" for none.
const target = shallowRef<string>()
void GoApp.collectTarget().then((dir) => {
  target.value = dir
})

function pick(dir: string) {
  target.value = dir
  void GoApp.setCollectTarget(dir)
}

const current = computed(() => (target.value === undefined
  ? undefined
  : recentFolders.value.find(folder => folder.path === target.value) ?? recentFolders.value[0]))

// Tells the Go side when the pick falls to the first folder.
watch([target, current], ([dir, folder]) => {
  if (dir !== undefined && folder?.path !== dir)
    void GoApp.setCollectTarget(folder?.path ?? '')
})

const items = computed<MenuItem[]>(() => recentFolders.value.map(folder => ({
  id: folder.path,
  label: folder.name,
  icon: folder.path === current.value?.path ? 'i-mingcute-check-line' : 'i-mingcute-folder-line',
  onSelect: () => pick(folder.path),
})))

const label = computed(() => {
  if (current.value)
    return current.value.name
  return recentFolders.value.length === 0 ? t('collect.noFolders') : t('collect.pickFolder')
})
</script>

<!--
  Where dropped pictures go: one of the folders added on the new-tab page.
  The Go side keeps the pick (see collect.go); while none is picked, or the
  picked one is no longer listed, the first listed folder is.
-->
<template>
  <div class="flex shrink-0 gap-1 min-w-0 items-center">
    <DropdownMenu :items="items">
      <button type="button" class="target text-caption" :disabled="recentFolders.length === 0" :title="current?.path">
        <span class="text-muted-foreground shrink-0">{{ t('collect.saveTo') }}</span>
        <span class="i-mingcute-folder-line size-3.5" />
        <span class="truncate wght-semibold">{{ label }}</span>
        <span class="i-mingcute-down-small-line text-muted-foreground size-3.5" />
      </button>
    </DropdownMenu>
    <IconButton
      :label="t('collect.openFolder')"
      icon="i-mingcute-folder-open-line"
      :disabled="!current"
      @click="current && openPath(current.path)"
    />
  </div>
</template>

<style scoped>
.target {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-grow: 1;
  height: 28px;
  padding-inline: 6px;
  margin-left: -6px;
  border-radius: 8px;
  background-color: transparent;
  cursor: pointer;
  color: var(--ps-foreground);
}

.target:hover:enabled {
  background-color: var(--ps-muted);
}

.target:disabled {
  cursor: default;
}
</style>
