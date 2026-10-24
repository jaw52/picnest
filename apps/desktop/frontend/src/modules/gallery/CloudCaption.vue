<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadingIds, useDownloadPlaceholder } from '~/composables/useDownloadPlaceholder'

const { photo, folderPath } = defineProps<{ photo: Photo, folderPath: string | null }>()

const { t } = useI18n()
const downloadPlaceholder = useDownloadPlaceholder(() => folderPath)
const downloading = computed(() => downloadingIds.value.has(photo.id))
</script>

<!-- Marks an undownloaded photo in the caption, with a button to download it. -->
<template>
  <span class="text-white/60 shrink-0 whitespace-nowrap">{{ t('preview.cloudOnly') }}</span>
  <button
    type="button"
    class="action text-caption"
    :disabled="downloading"
    @click="downloadPlaceholder(photo)"
  >
    {{ downloading ? t('gallery.downloading') : t('preview.downloadOriginal') }}
  </button>
</template>

<style scoped>
.action {
  flex-shrink: 0;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 8px;
  padding: 2px 8px;
  background-color: rgb(255 255 255 / 0.12);
  color: white;
  transition: background-color 80ms;
}

.action:hover {
  background-color: rgb(255 255 255 / 0.24);
}
</style>
