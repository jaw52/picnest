<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useFileName } from '~/composables/useFileName'
import CloudPreview from './CloudPreview.vue'
import FittedImage from './FittedImage.vue'
import { placeholderFor } from './lightboxPlaceholder'

const { photo } = defineProps<{ photo: Photo, folderPath: string | null, src: string }>()

const fileName = useFileName(() => photo)
</script>

<!-- The photo either side of the one shown, in place for a swipe to slide in. -->
<template>
  <CloudPreview v-if="photo.isCloudPlaceholder" :photo="photo" :folder-path="folderPath" />
  <FittedImage v-else :src="src" :placeholder="placeholderFor(folderPath, photo)" :alt="fileName" />
</template>
