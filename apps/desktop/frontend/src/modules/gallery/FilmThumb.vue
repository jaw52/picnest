<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useFileName } from '~/composables/useFileName'
import { thumbnailEdgeFor, useThumbnail } from '~/composables/useThumbnail'
import { FILM_THUMB } from './filmstrip'

const { photo, folderPath } = defineProps<{ photo: Photo, folderPath: string | null }>()

const url = useThumbnail(() => folderPath, () => photo.path, thumbnailEdgeFor(FILM_THUMB), { cloud: () => photo.isCloudPlaceholder })
// Names the button, for a library photo, whose name is read as it shows.
const fileName = useFileName(() => photo)
</script>

<template>
  <span v-if="photo.isCloudPlaceholder && !url" class="text-white/60 flex size-full items-center justify-center">
    <span class="i-mingcute-cloud-line size-4" />
  </span>
  <!-- The whole photo, letterboxed in its square. -->
  <img v-else-if="url" :src="url" :alt="fileName" draggable="false" class="size-full block object-contain">
</template>
