<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useI18n } from 'vue-i18n'
import { thumbnailEdgeFor, useThumbnail } from '~/composables/useThumbnail'

const { photo, folderPath, width, height } = defineProps<{
  photo: Photo
  folderPath: string
  width: number
  height: number
}>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()
const thumbnailUrl = useThumbnail(() => folderPath, () => photo.path, () => thumbnailEdgeFor(width), { cloud: () => photo.isCloudPlaceholder })
</script>

<template>
  <div class="confirm-tile" :style="{ width: `${width}px`, height: `${height}px` }">
    <div v-if="photo.isCloudPlaceholder && !thumbnailUrl" class="text-muted-foreground flex size-full items-center justify-center">
      <span class="i-mingcute-cloud-line size-5" />
    </div>
    <img
      v-else-if="thumbnailUrl"
      :src="thumbnailUrl"
      :alt="photo.fileName"
      decoding="async"
      draggable="false"
      class="size-full object-cover"
    >
    <div class="file-name revealed text-caption truncate">
      {{ photo.fileName }}
    </div>
    <button
      type="button"
      class="remove revealed"
      :aria-label="t('deleteConfirm.keep', { name: photo.fileName })"
      :title="t('deleteConfirm.keepTitle')"
      @click="emit('remove')"
    >
      <span class="i-mingcute-back-line size-3.5" />
    </button>
  </div>
</template>

<style scoped>
.confirm-tile {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-color: var(--ps-muted);
}

.file-name {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  padding: 16px 8px 6px;
  text-align: center;
  pointer-events: none;
  color: rgb(255 255 255 / 0.9);
  background-image: linear-gradient(to top, rgb(0 0 0 / 0.7), transparent);
}

/* Revealed while the tile is hovered or the button has keyboard focus. */
.revealed {
  opacity: 0;
  transition: opacity 80ms;
}

.confirm-tile:hover .revealed,
.confirm-tile:focus-within .revealed {
  opacity: 1;
}

.remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  border-radius: 9999px;
  background-color: rgb(0 0 0 / 0.6);
  color: white;
  outline: none;
}

.remove:hover {
  background-color: rgb(0 0 0 / 0.8);
}

.remove:focus-visible {
  outline: 2px solid var(--ps-focus-ring);
}
</style>
