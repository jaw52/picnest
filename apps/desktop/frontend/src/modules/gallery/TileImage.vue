<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '~/components/BaseButton.vue'
import IconButton from '~/components/IconButton.vue'
import { downloadingIds, useDownloadPlaceholder } from '~/composables/useDownloadPlaceholder'

const { photo, folderPath } = defineProps<{
  photo: Photo
  fileName: string
  thumbnailUrl: string | undefined
  folderPath: string | null
}>()

const { t } = useI18n()
const downloadPlaceholder = useDownloadPlaceholder(() => folderPath)
const downloading = computed(() => downloadingIds.value.has(photo.id))
const downloadLabel = computed(() => (downloading.value ? t('gallery.downloading') : t('gallery.download')))

function download() {
  void downloadPlaceholder(photo)
}
</script>

<!--
  The tile's picture: the thumbnail, iCloud's thumbnail with a download
  button for an undownloaded file, or a "not downloaded" tile if iCloud has
  none.
-->
<template>
  <img
    v-if="thumbnailUrl"
    :src="thumbnailUrl"
    :alt="fileName"
    decoding="async"
    draggable="false"
    class="size-full object-cover"
  >
  <div v-else-if="!photo.isCloudPlaceholder" class="loading size-full" />
  <div v-if="photo.isCloudPlaceholder && thumbnailUrl" class="left-1.5 top-1.5 absolute z-1">
    <IconButton
      variant="secondary"
      :label="downloadLabel"
      :icon="downloading ? 'i-mingcute-loading-line' : 'i-mingcute-cloud-line'"
      :disabled="downloading"
      @click.stop="download"
    />
  </div>
  <div
    v-else-if="photo.isCloudPlaceholder"
    class="text-muted-foreground flex flex-col gap-1 size-full items-center justify-center"
  >
    <span class="i-mingcute-cloud-line size-5" />
    <span class="text-caption">{{ t('gallery.notDownloaded') }}</span>
    <!-- Above the hover overlay, which would otherwise swallow the click. -->
    <BaseButton
      variant="secondary"
      size="compact"
      class="relative z-1"
      :leading-icon="downloading ? 'i-mingcute-loading-line' : undefined"
      :disabled="downloading"
      @click.stop="download"
    >
      {{ downloadLabel }}
    </BaseButton>
  </div>
</template>

<style scoped>
.loading {
  background-color: var(--ps-active);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}
</style>
