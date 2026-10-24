<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import StarRating from '~/components/StarRating.vue'
import { useFileName } from '~/composables/useFileName'

const { photo } = defineProps<{ photo: Photo }>()
const emit = defineEmits<{ rate: [rating: number] }>()

const { t } = useI18n()
const rating = shallowRef(false)
const fileName = useFileName(() => photo)
</script>

<!--
  The file name over the bottom of a tile, and beside it a button showing
  the rating. Hovering that button unfolds a row under the name to rate the
  photo with: "no rating", then 1-5 stars. Revealed while the tile is
  hovered, on a gradient, so it stays legible on any photo. A double-click
  here is a slow rating, not a request to preview.
-->
<template>
  <div role="presentation" class="caption" @mouseleave="rating = false" @focusout="rating = false" @dblclick.stop>
    <div class="flex gap-1 max-w-full items-center">
      <span class="text-caption text-white/90 min-w-0 pointer-events-none truncate">{{ fileName }}</span>
      <!-- The tile is the grid's tab stop; keys 0-5 rate from there. -->
      <button
        type="button"
        class="rating-button text-caption wght-semibold"
        :aria-label="t('rating.label')"
        :aria-expanded="rating"
        tabindex="-1"
        @mouseenter="rating = true"
        @focus="rating = true"
        @click.stop="rating = !rating"
      >
        <template v-if="photo.rating > 0">
          <span class="i-mingcute-star-fill size-3" />
          {{ photo.rating }}
        </template>
        <span v-else class="i-mingcute-star-line size-3" />
      </button>
    </div>
    <!-- The stars' row, folded to no height until the rating button is hovered. -->
    <div class="fold" :class="{ unfolded: rating }">
      <div class="min-h-0 overflow-hidden" :inert="!rating">
        <div class="pt-1">
          <StarRating :rating="photo.rating" :size="16" :focusable="false" @change="r => emit('rate', r)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.caption {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px 6px;
  background-image: linear-gradient(to top, rgb(0 0 0 / 0.7), transparent);
  opacity: 0;
  transition: opacity 80ms;
}

:global(.photo-tile:hover) .caption,
:global(.photo-tile:focus-within) .caption {
  opacity: 1;
}

.rating-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  height: 20px;
  padding-inline: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--ps-rating);
  background-color: rgb(255 255 255 / 0.12);
  transition: background-color 80ms;
}

.rating-button:hover {
  background-color: rgb(255 255 255 / 0.24);
}

.fold {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 80ms;
}

.fold.unfolded {
  grid-template-rows: 1fr;
}
</style>
