<script setup lang="ts">
import { SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed, shallowRef, useTemplateRef } from 'vue'

const { min = 0, max = 100, step = 1, label, formatValue = String, showValue = true, disabled = false } = defineProps<{
  min?: number
  max?: number
  step?: number
  /** The thumb's accessible name, also shown as the value label's prefix. */
  label?: string
  /** Formats the displayed value. */
  formatValue?: (value: number) => string
  /** Off, no text shows, for a value whose number means nothing to the user; the label stays as the thumb's accessible name. */
  showValue?: boolean
  disabled?: boolean
}>()

const value = defineModel<number>({ required: true })

/**
 * The thumb's layout box. Travel is the track width minus this, so the thumb
 * never overhangs either end; the visible knob is the smaller circle inside it.
 */
const THUMB_SIZE = 20

interface Preview {
  left: number
  width: number
  rightward: boolean
}

const control = useTemplateRef<{ $el: HTMLElement }>('control')
const hovered = shallowRef(false)
const dragging = shallowRef(false)
const preview = shallowRef<Preview | null>(null)

const span = computed(() => max - min || 1)
const fraction = computed(() => (value.value - min) / span.value)
// The fill ends at the thumb center.
const fillWidth = computed(() => `calc(${THUMB_SIZE / 2}px + ${fraction.value} * (100% - ${THUMB_SIZE}px))`)

function updatePreview(clientX: number) {
  const el = control.value?.$el
  if (!el)
    return
  const rect = el.getBoundingClientRect()
  const usable = rect.width - THUMB_SIZE
  if (usable <= 0)
    return
  const x = Math.max(0, Math.min(usable, clientX - rect.left - THUMB_SIZE / 2))
  const raw = (x / usable) * span.value + min
  const snapped = Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min))
  const snappedX = THUMB_SIZE / 2 + ((snapped - min) / span.value) * usable
  const thumbX = THUMB_SIZE / 2 + fraction.value * usable
  // Extend to the track edges at the extremes so there's no gap.
  const edgeX = snapped === min ? 0 : (snapped === max ? rect.width : snappedX)
  preview.value = {
    left: Math.min(thumbX, edgeX),
    width: Math.abs(edgeX - thumbX),
    rightward: edgeX > thumbX,
  }
}

const interacting = computed(() => hovered.value || dragging.value)
const valueLabel = (v: number) => `${label ? `${label}: ` : ''}${formatValue(v)}`

const previewStyle = computed(() => ({
  left: `${preview.value?.left ?? 0}px`,
  width: `${preview.value?.width ?? 0}px`,
  borderRadius: (preview.value?.rightward ?? true) ? '0 9999px 9999px 0' : '9999px 0 0 9999px',
}))

function onPointerLeave() {
  hovered.value = false
  preview.value = null
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value)
    updatePreview(e.clientX)
}
</script>

<!--
  A value label and a thumb on a thin rail. Reka owns the pointer handling,
  ARIA and arrow keys; hovering previews a click with a bar from the thumb to
  the step under the cursor.
-->
<template>
  <div class="slider flex gap-2 w-full items-center" :class="{ disabled }">
    <span v-if="showValue" class="value shrink-0 inline-grid" :class="interacting ? 'wght-semibold' : 'wght-normal'">
      <!-- Invisible ghost reserves the width of the widest possible value. -->
      <span aria-hidden="true" class="stack-cell invisible whitespace-nowrap wght-semibold">{{ valueLabel(max) }}</span>
      <span class="stack-cell whitespace-nowrap">{{ valueLabel(value) }}</span>
    </span>
    <!-- The root is the pressable area: Reka measures pointer positions against it. -->
    <SliderRoot
      ref="control"
      :model-value="[value]"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      thumb-alignment="contain"
      class="control"
      @update:model-value="next => next && (value = next[0])"
      @value-commit="dragging = false"
      @pointerdown="dragging = true"
      @pointerenter="hovered = true"
      @pointerleave="onPointerLeave"
      @pointermove="onPointerMove"
    >
      <SliderTrack class="track">
        <div class="fill" :style="{ width: fillWidth }" />
        <div class="preview" :class="{ shown: preview && !dragging }" :style="previewStyle" />
      </SliderTrack>
      <!-- An explicit tabindex: WebKit otherwise leaves the thumb out of the Tab order. -->
      <SliderThumb :aria-label="label" :tabindex="0" class="thumb">
        <span class="knob" />
      </SliderThumb>
    </SliderRoot>
  </div>
</template>

<style scoped>
.slider {
  user-select: none;
  touch-action: none;
}

.slider.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Weight, not color, signals interaction: normal → semibold while hovered or
   pressed. tabular-nums plus a ghost set at semibold (the heaviest this
   label gets) keep the box from changing width. */
.value {
  font-size: var(--ps-fs-body);
  line-height: 1;
  color: var(--ps-muted-foreground);
  font-variant-numeric: tabular-nums;
  transition: font-variation-settings 100ms;
}

/* 8px above and below the 20px thumb row, so the press target is 36px tall. */
.control {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 36px;
  cursor: ew-resize;
}

/* The unfilled rail is hatched with fine diagonal stripes. overflow hidden
   clips the fill and hover bar to it, so they inherit its rounded ends. */
.track {
  position: absolute;
  left: 0;
  right: 0;
  top: 15px;
  height: 6px;
  border-radius: 9999px;
  overflow: hidden;
  background-color: color-mix(in srgb, var(--ps-foreground) 10%, transparent);
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--ps-foreground) 8%, transparent) 0 1px,
    transparent 1px 3px
  );
}

.fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: color-mix(in srgb, var(--ps-foreground) 30%, transparent);
}

@media (prefers-color-scheme: dark) {
  .fill {
    background-color: color-mix(in srgb, var(--ps-foreground) 40%, transparent);
  }
}

/* The bar previews what a click would change: it runs from the thumb's
   center to the snapped hover value, fading over 150ms. */
.preview {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  background-color: color-mix(in srgb, var(--ps-foreground) 20%, transparent);
  transition: opacity 150ms;
}

.preview.shown {
  opacity: 1;
}

/* A 20px box centered on the track holding the 18px knob. The ring is drawn
   around the box, for keyboard focus only. */
.thumb {
  position: absolute;
  top: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  outline: none;
  outline-offset: 1px;
  z-index: 10;
}

.thumb:focus-visible {
  outline: 1px solid var(--ps-focus-ring);
}

.knob {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background-color: white;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  transition:
    width 80ms,
    height 80ms;
}
</style>
