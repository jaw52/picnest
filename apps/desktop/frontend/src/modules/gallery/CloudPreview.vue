<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useI18n } from 'vue-i18n'
import { useThumbnail } from '~/composables/useThumbnail'
import FittedImage from './FittedImage.vue'

const { photo, folderPath } = defineProps<{ photo: Photo, folderPath: string | null }>()

/**
 * The longest edge iCloud keeps a thumbnail at. An undownloaded photo is
 * previewed from that, upscaled to fit.
 */
const CLOUD_PREVIEW_EDGE = 1024

const { t } = useI18n()
const url = useThumbnail(() => folderPath, () => photo.path, CLOUD_PREVIEW_EDGE, { cloud: true })
</script>

<!-- An undownloaded photo, shown from iCloud's thumbnail when it has one. -->
<template>
  <FittedImage v-if="url" :src="url" :alt="photo.fileName" />
  <div v-else class="text-body text-white/80 m-auto">
    {{ t('preview.notDownloaded') }}
  </div>
</template>
