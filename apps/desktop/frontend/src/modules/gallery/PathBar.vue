<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconButton from '~/components/IconButton.vue'
import { folderNameFromPath, folderRoots, pathSegments } from '~/lib/folders'
import { isLibraryPath } from '~/lib/library'
import { useGallery } from '~/state/gallery'
import { recentFolders } from '~/state/recentFolders'
import { activeTabPath, canGoBack, canGoForward, goBack, goForward, openFromClick } from '~/state/tabs'
import SubfolderMenu from './SubfolderMenu.vue'

const { t } = useI18n()
const { subfolders } = useGallery()
const segments = computed(() => {
  const path = activeTabPath.value
  return path ? pathSegments(path, folderRoots(recentFolders.value).map(f => f.path)) : []
})
const shown = computed(() => segments.value.length > 1 || subfolders.value.length > 0 || canGoBack.value || canGoForward.value)

function open(segment: string, isCurrent: boolean, e: MouseEvent) {
  if (!isCurrent)
    openFromClick(segment, e)
}
</script>

<!--
  Back and forward through the folders the tab showed, then breadcrumbs for
  the one it shows: click a parent to go up (⌘-click for a new tab), or a
  chevron to jump to a sibling. Left out while there is nowhere to go: a
  top-level folder with no subfolders and no history.
-->
<template>
  <nav v-if="shown" :aria-label="t('path.breadcrumb')" class="flex gap-0.5 min-w-0 items-center">
    <div class="mr-1.5 flex shrink-0 gap-0.5">
      <IconButton :label="t('path.back')" icon="i-mingcute-arrow-left-line" :disabled="!canGoBack" @click="goBack" />
      <IconButton :label="t('path.forward')" icon="i-mingcute-arrow-right-line" :disabled="!canGoForward" @click="goForward" />
    </div>
    <template v-for="(segment, i) in segments" :key="segment">
      <button
        type="button"
        class="segment text-caption"
        :class="{ current: i === segments.length - 1 }"
        :aria-current="i === segments.length - 1 ? 'page' : undefined"
        @click="open(segment, i === segments.length - 1, $event)"
        @auxclick="$event.button === 1 && open(segment, i === segments.length - 1, $event)"
      >
        <span v-if="i === 0" class="size-3.5" :class="isLibraryPath(segment) ? 'i-mingcute-pic-line' : 'i-mingcute-folder-line'" />
        <span class="truncate" :class="i === segments.length - 1 ? 'wght-semibold' : 'wght-normal'">
          {{ isLibraryPath(segment) ? t('library.name') : folderNameFromPath(segment) }}
        </span>
      </button>
      <!-- The current folder's subfolders are in the grid below. -->
      <SubfolderMenu v-if="i !== segments.length - 1" :folder="segment" />
    </template>
  </nav>
</template>

<style scoped>
.segment {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 200px;
  height: 24px;
  padding-inline: 6px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--ps-muted-foreground);
  background-color: transparent;
  transition:
    color 80ms,
    background-color 80ms;
}

.segment:hover {
  color: var(--ps-foreground);
  background-color: var(--ps-hover);
}

.segment.current {
  cursor: default;
  color: var(--ps-foreground);
  background-color: transparent;
}
</style>
