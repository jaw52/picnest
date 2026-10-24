<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { rating, size = 16, focusable = true } = defineProps<{
  rating: number
  /** Glyph size in px. */
  size?: number
  /** False keeps the buttons out of the Tab order, where keys 0-5 rate already. */
  focusable?: boolean
}>()

const emit = defineEmits<{ change: [rating: number] }>()

const { t } = useI18n()
const hovered = shallowRef<number | null>(null)
const display = computed(() => hovered.value ?? rating)
const tabIndex = computed(() => (focusable ? undefined : -1))
const glyph = computed(() => ({ width: `${size}px`, height: `${size}px` }))
const STARS = [1, 2, 3, 4, 5]
</script>

<!--
  Interactive 0-5 rating: a "no rating" button, then five stars. Clicking
  the currently-set star clears it too. The buttons touch, so moving between
  them never shows the rating between two previews.
-->
<template>
  <div class="inline-flex items-center">
    <button
      type="button"
      class="star"
      :class="hovered === 0 ? 'filled' : 'empty'"
      :aria-label="t('rating.none')"
      :aria-pressed="rating === 0"
      :tabindex="tabIndex"
      @mouseenter="hovered = 0"
      @focus="hovered = 0"
      @mouseleave="hovered = null"
      @blur="hovered = null"
      @click.stop="emit('change', 0)"
    >
      <span class="i-mingcute-forbid-circle-line" :style="glyph" />
    </button>
    <button
      v-for="star in STARS"
      :key="star"
      type="button"
      class="star"
      :class="star <= display ? 'filled' : 'empty'"
      :aria-label="t('rating.stars', star)"
      :aria-pressed="star <= rating"
      :tabindex="tabIndex"
      @mouseenter="hovered = star"
      @focus="hovered = star"
      @mouseleave="hovered = null"
      @blur="hovered = null"
      @click.stop="emit('change', star === rating ? 0 : star)"
    >
      <span :class="star <= display ? 'i-mingcute-star-fill' : 'i-mingcute-star-line'" :style="glyph" />
    </button>
  </div>
</template>

<style scoped>
.star {
  cursor: pointer;
  padding: 2px 3px;
  line-height: 1;
  background-color: transparent;
  border-radius: 4px;
  outline: none;
  transition: color 80ms;
}

.star:focus-visible {
  outline: 2px solid var(--ps-focus-ring);
}

/* Set on the buttons: an icon's own color is currentColor. */
.filled {
  color: var(--ps-rating);
}

/* Outlined in the rating's own color, on the page or over a photo alike;
   the "no rating" button too, solid under the pointer. */
.empty {
  color: color-mix(in srgb, var(--ps-rating) 70%, transparent);
}
</style>
