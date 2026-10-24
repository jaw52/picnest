<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ProgressBar from '~/components/ProgressBar.vue'
import { useGallery } from '~/state/gallery'

const { t } = useI18n()
const { thumbnailProgress } = useGallery()
</script>

<template>
  <ProgressBar
    v-if="thumbnailProgress.total > 0"
    :label="t('gallery.thumbnailProgress')"
    :value="thumbnailProgress.done"
    :max="thumbnailProgress.total"
    thin
  />
</template>
