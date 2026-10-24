<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseSlider from '~/components/BaseSlider.vue'
import IconButton from '~/components/IconButton.vue'
import { useDeletePhoto } from '~/composables/useDeletePhoto'
import { useOpenFolder } from '~/composables/useOpenFolder'
import { THUMBNAIL_WIDTH_MAX, THUMBNAIL_WIDTH_MIN, thumbnailWidth, useGallery } from '~/state/gallery'

const { t } = useI18n()
const { currentFolder, isScanning, selectedPhotoIds, filteredPhotos, bulkDeleteBlocked } = useGallery()
const blocked = computed(() => bulkDeleteBlocked.value && selectedPhotoIds.value.size > 1)
const { navigateToFolder } = useOpenFolder()
const deletePhoto = useDeletePhoto(currentFolder)

function deleteSelected() {
  void deletePhoto(filteredPhotos.value.filter(p => selectedPhotoIds.value.has(p.id)))
}

function rescan() {
  if (currentFolder.value)
    void navigateToFolder(currentFolder.value)
}
</script>

<!--
  The controls of the folder a tab shows, which it puts in the tab bar. They
  keep their room on the new-tab page, only hidden: the tabs, which shrink to
  fit, would otherwise widen at once on switching.
-->
<template>
  <div class="flex shrink-0 gap-1 items-center" :class="{ invisible: !currentFolder }" :aria-hidden="!currentFolder">
    <!-- The whole track is clickable, not just the thumb, so none of it may drag the window. -->
    <div data-no-drag class="mr-2 shrink-0 w-48">
      <!-- Also ⌘= / ⌘- / ⌘0, or a pinch on the grid. -->
      <BaseSlider
        v-model="thumbnailWidth"
        :label="t('gallery.thumbnailSize')"
        :min="THUMBNAIL_WIDTH_MIN"
        :max="THUMBNAIL_WIDTH_MAX"
        :step="10"
        :show-value="false"
      />
    </div>
    <IconButton
      :label="blocked ? t('gallery.bulkDeleteWaits') : t('gallery.deleteSelected')"
      icon="i-mingcute-delete-2-line"
      :disabled="selectedPhotoIds.size === 0 || blocked"
      @click="deleteSelected"
    />
    <IconButton
      :label="t('gallery.rescan')"
      icon="i-mingcute-refresh-2-line"
      :icon-class="isScanning ? 'animate-spin' : undefined"
      :disabled="!currentFolder || isScanning"
      @click="rescan"
    />
  </div>
</template>
