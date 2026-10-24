<script setup lang="ts">
import type { PhotoGrouping, RatingFilter } from '~/lib/photo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TabsSubtle from '~/components/TabsSubtle.vue'
import TabsSubtleItem from '~/components/TabsSubtleItem.vue'
import { ratingCounts } from '~/lib/photo'
import { photoGrouping, useGallery } from '~/state/gallery'
import PathBar from './PathBar.vue'

const STARS = [1, 2, 3, 4, 5]
// Tab order: 全部 (null), 未评分 (0), then 1-5 stars.
const FILTERS: RatingFilter[] = [null, 0, ...STARS]
const GROUPINGS: PhotoGrouping[] = [null, 'year', 'month', 'day']

const { t } = useI18n()
const gallery = useGallery()
const { photos, ratingFilter, isScanning, photosTotal } = gallery
const counts = computed(() => ratingCounts(photos.value))
// While pages are still loading, the backend's count, rather than one
// climbing a page at a time.
const allCount = computed(() => (isScanning.value ? Math.max(photosTotal.value, photos.value.length) : photos.value.length))

const groupingLabels = computed(() => ({
  none: t('gallery.groupNone'),
  year: t('gallery.groupYear'),
  month: t('gallery.groupMonth'),
  day: t('gallery.groupDay'),
}))

function setGrouping(value: PhotoGrouping) {
  photoGrouping.value = value
}

// Changing which photos are visible invalidates the current selection -
// clear it rather than leaving stale/hidden ids selected.
function setFilter(value: RatingFilter) {
  ratingFilter.value = value
  gallery.selectedPhotoIds.value = new Set()
  gallery.selectedPhotoId.value = null
  gallery.setPreviewPhotoId(null)
}
</script>

<template>
  <div class="px-3 py-1.5 border-b border-border flex flex-wrap gap-x-3 gap-y-1 items-center">
    <PathBar />
    <!-- The grouping and the rating filters sit at the right end, after the path. -->
    <div class="ml-auto flex flex-wrap gap-x-3 items-center">
      <!-- By when the photos were taken, the newest first. -->
      <TabsSubtle
        :selected-index="Math.max(0, GROUPINGS.indexOf(photoGrouping))"
        @select="index => setGrouping(GROUPINGS[index] ?? null)"
      >
        <TabsSubtleItem
          v-for="(value, index) in GROUPINGS"
          :key="value ?? 'none'"
          :index="index"
          :label="groupingLabels[value ?? 'none']"
        />
      </TabsSubtle>
      <TabsSubtle
        :selected-index="Math.max(0, FILTERS.indexOf(ratingFilter))"
        @select="index => setFilter(FILTERS[index] ?? null)"
      >
        <TabsSubtleItem :index="0" :label="t('gallery.filterAll', { count: allCount })" />
        <TabsSubtleItem :index="1" :label="t('gallery.filterUnrated', { count: counts[0] })" :dimmed="counts[0] === 0" />
        <TabsSubtleItem
          v-for="star in STARS"
          :key="star"
          :index="star + 1"
          :label="`${star}★ ${counts[star]}`"
          :dimmed="counts[star] === 0"
        />
      </TabsSubtle>
    </div>
  </div>
</template>
