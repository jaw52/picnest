<script setup lang="ts">
import type { View } from '~/lib/zoom'
import type { FullImage, LiveVideo, Placeholder } from '~/types/lightbox'
import type { MenuItem } from '~/types/menu'
import { useEventListener } from '@vueuse/core'
import { motion } from 'motion-v'
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import ContextMenu from '~/components/ContextMenu.vue'
import { spring } from '~/lib/springs'
import { actualSizeScale, clampView, FIT, zoomAbout } from '~/lib/zoom'
import PlaceholderImage from './PlaceholderImage.vue'
import { useLoaded } from './useLoaded'
import './lightbox.css'

const { src, full, placeholder, live, fadeIn } = defineProps<{
  src: string
  /** Loaded over `src` once zoomed in, and what actual size means. */
  full?: FullImage
  /** Shown while `src` loads, with a spinner over it. */
  placeholder?: Placeholder
  /** Played over the photo: once through while its badge is hovered, or over and over. */
  live?: LiveVideo
  alt: string
  /** Fade and scale the photo in on mount; off when it replaces another. */
  fadeIn: boolean
  menuItems: MenuItem[]
}>()

/** Movement under this is a click, not a drag. */
const DRAG_THRESHOLD = 3
/**
 * How long the view stays still before the full-size photo shows over the
 * scaled copy: past the 200ms zoom animation (.smooth), and between a
 * pinch's or a drag's steps.
 */
const VIEW_SETTLE_MS = 250
/** Pinch deltas arrive as small wheel `deltaY`s with ctrl held; this turns them into a zoom factor. */
const WHEEL_ZOOM_RATE = 0.01

interface WebKitGestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

const { t } = useI18n()
const { loaded, onLoad, onError } = useLoaded(() => src)
const { loaded: fullLoaded, onLoad: onFullLoad, onError: onFullError } = useLoaded(() => full?.src ?? '')
const viewport = useTemplateRef<HTMLElement>('viewport')
const stage = useTemplateRef<HTMLElement>('stage')
const image = useTemplateRef<{ $el: HTMLImageElement }>('image')
const view = shallowRef<View>(FIT)
const smooth = shallowRef(false)
const dragging = shallowRef(false)
let gesture: { base: number } | null = null
let drag: { x: number, y: number, view: View, moved: boolean } | null = null
let suppressClick = false

// WebKit stalls a frame for 150-220ms painting a photo of 12 megapixels or
// more the first time, so the full-size one shows once the view stops
// moving rather than halting a zoom animation or a pinch midway.
const moving = shallowRef(false)
let settle: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(settle))

function updateView(next: View, animated = false) {
  smooth.value = animated
  view.value = next
  moving.value = true
  clearTimeout(settle)
  settle = setTimeout(() => {
    moving.value = false
  }, VIEW_SETTLE_MS)
}

function measure() {
  const viewportEl = viewport.value
  const stageEl = stage.value
  const imageEl = image.value?.$el
  if (!viewportEl || !stageEl || !imageEl)
    return null
  const rect = stageEl.getBoundingClientRect()
  const vRect = viewportEl.getBoundingClientRect()
  const v = view.value
  // The photo's own width in pixels, however large `src` is.
  const photoWidth = full?.width ?? imageEl.naturalWidth
  const actual = actualSizeScale(photoWidth, imageEl.offsetWidth)
  return {
    // Where the photo is centered on screen, whatever it is currently scaled or panned to.
    centerX: rect.left + rect.width / 2 - v.x,
    centerY: rect.top + rect.height / 2 - v.y,
    box: {
      imageW: imageEl.offsetWidth,
      imageH: imageEl.offsetHeight,
      viewW: viewportEl.clientWidth,
      viewH: viewportEl.clientHeight,
      offsetX: rect.left + rect.width / 2 - v.x - (vRect.left + vRect.width / 2),
      offsetY: rect.top + rect.height / 2 - v.y - (vRect.top + vRect.height / 2),
    },
    max: Math.max(4, actual * 4),
    actual,
  }
}

function zoomTo(scale: number, clientX: number, clientY: number, animated = false) {
  const m = measure()
  if (m)
    updateView(zoomAbout(view.value, scale, clientX - m.centerX, clientY - m.centerY, m.box, m.max), animated)
}

// Native listeners, not passive, so a wheel event can be cancelled.
useEventListener(viewport, 'wheel', (e: WheelEvent) => {
  // Stops the page scrolling, or WebKit zooming the whole page.
  e.preventDefault()
  // At fit, a plain two-finger scroll is left to bubble up to the lightbox,
  // which turns a horizontal swipe into the next or previous photo.
  if (gesture || e.ctrlKey || view.value.scale > 1)
    e.stopPropagation()
  if (gesture)
    return
  if (e.ctrlKey) {
    zoomTo(view.value.scale * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE), e.clientX, e.clientY)
    return
  }
  if (view.value.scale <= 1)
    return
  const m = measure()
  if (m) {
    const { x, y } = view.value
    updateView(clampView({ ...view.value, x: x - e.deltaX, y: y - e.deltaY }, m.box))
  }
}, { passive: false })
useEventListener(viewport, 'gesturestart', (e: Event) => {
  e.preventDefault()
  gesture = { base: view.value.scale }
})
useEventListener(viewport, 'gesturechange', (e: Event) => {
  e.preventDefault()
  const g = e as WebKitGestureEvent
  if (gesture)
    zoomTo(gesture.base * g.scale, g.clientX, g.clientY)
})
useEventListener(viewport, 'gestureend', (e: Event) => {
  e.preventDefault()
  gesture = null
})

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !zoomed.value)
    return
  suppressClick = false
  drag = { x: e.clientX, y: e.clientY, view: view.value, moved: false }
}

function onPointerMove(e: PointerEvent) {
  const d = drag
  if (!d)
    return
  const dx = e.clientX - d.x
  const dy = e.clientY - d.y
  if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD)
    return
  if (!d.moved) {
    // Captured only once it is a drag: capturing on press would redirect a
    // plain click from the photo to the viewport.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    d.moved = true
    dragging.value = true
  }
  const m = measure()
  if (m)
    updateView(clampView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy }, m.box))
}

function onPointerUp() {
  // A drag that ends over the backdrop must not close the lightbox.
  suppressClick = drag?.moved ?? false
  drag = null
  dragging.value = false
}

function onClickCapture(e: MouseEvent) {
  if (!suppressClick)
    return
  suppressClick = false
  e.stopPropagation()
}

function onImageClick(e: MouseEvent) {
  const m = measure()
  if (!m)
    return
  if (zoomed.value)
    updateView(FIT, true)
  else
    zoomTo(m.actual, e.clientX, e.clientY, true)
}

const zoomed = computed(() => view.value.scale > 1)
// The photo itself loads the first time it's zoomed into, and stays; it
// shows once loaded and the view has settled.
const wantFull = shallowRef(false)
const fullShown = shallowRef(false)
watchEffect(() => {
  if (zoomed.value && full)
    wantFull.value = true
  if (fullLoaded.value && !moving.value)
    fullShown.value = true
})

const cursor = computed(() => {
  if (dragging.value)
    return 'cursor-grabbing'
  return zoomed.value ? 'cursor-grab' : 'cursor-zoom-in'
})

/*
 * A Live Photo's video, laid over the photo, and the badge that plays it. A
 * loop plays from the start, over and over; a Live Photo plays once through
 * while its badge is hovered, as in Photos. Zoomed in, the photo shows still.
 */
const video = useTemplateRef<HTMLVideoElement>('video')
// Asked to play, and playing: it is read from Photos the first time.
const wanted = shallowRef(false)
const playing = shallowRef(false)
watch([zoomed, () => live?.loop ?? false, video], ([isZoomed, loop, el]) => {
  if (!el)
    return
  if (isZoomed)
    el.pause()
  else if (loop)
    el.play().catch(() => {})
}, { immediate: true })

function play() {
  const el = video.value
  if (!el)
    return
  wanted.value = true
  el.currentTime = 0
  el.play().catch(() => {})
}

function stop() {
  wanted.value = false
  video.value?.pause()
}

function onEnded() {
  playing.value = false
  wanted.value = false
}
</script>

<!--
  The lightbox photo with trackpad zoom: pinch to zoom around the cursor,
  two-finger scroll to pan once zoomed (at fit it bubbles up, for swiping
  between photos), drag to pan, click to jump between fit and actual size.
  Pinch arrives as `gesture*` events in WebKit (the macOS webview) and as
  ctrl+wheel in Chromium; both are handled.
-->
<template>
  <div
    ref="viewport"
    role="presentation"
    class="lb-viewport"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @click.capture="onClickCapture"
  >
    <ContextMenu :items="menuItems">
      <div
        ref="stage"
        class="lb-stage"
        :class="{ smooth }"
        :style="{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }"
      >
        <PlaceholderImage v-if="placeholder" :placeholder="placeholder" />
        <motion.img
          ref="image"
          :src="src"
          :alt="alt"
          decoding="sync"
          draggable="false"
          class="lb-image"
          :class="[cursor, { 'lb-over': placeholder, 'lb-unloaded': placeholder && !loaded }]"
          :initial="fadeIn ? { opacity: 0, scale: 0.98 } : false"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="spring.slow"
          @load="onLoad"
          @error="onError"
          @click.stop="onImageClick"
        />
        <img
          v-if="wantFull && full"
          :src="full.src"
          alt=""
          draggable="false"
          class="lb-image lb-over lb-pass-through"
          :class="{ 'lb-unloaded': !fullShown }"
          @load="onFullLoad"
          @error="onFullError"
        >
        <!-- A Live Photo's sound is ambient, with nothing to caption. -->
        <video
          v-if="live"
          ref="video"
          :src="live.src"
          :muted="live.loop"
          playsinline
          :loop="live.loop"
          preload="auto"
          class="live-video lb-image lb-over lb-pass-through"
          :class="{ playing }"
          @playing="playing = true"
          @pause="playing = false"
          @ended="onEnded"
        />
        <span
          v-if="placeholder && !loaded"
          class="spinner i-mingcute-loading-line text-white size-6 left-1/2 top-1/2 absolute animate-spin -ml-3 -mt-3"
        />
        <!-- Marks a Live Photo in its corner; hovering it plays the video. -->
        <span
          v-if="live && !live.loop && !zoomed"
          role="presentation"
          class="live-badge text-caption"
          @pointerenter="play"
          @pointerleave="stop"
          @click.stop
        >
          <span v-if="wanted && !playing" class="i-mingcute-loading-line size-3.5 animate-spin" />
          <span v-else class="i-mingcute-live-photo-line size-3.5" />
          {{ t('preview.live') }}
        </span>
      </div>
    </ContextMenu>
  </div>
</template>

<style scoped>
.smooth {
  transition: transform 200ms ease-out;
}

.spinner {
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.5));
}

/* Faded in once it plays. */
.live-video {
  opacity: 0;
  transition: opacity 80ms;
}

.live-video.playing {
  opacity: 1;
}

.live-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 9999px;
  padding: 2px 8px;
  background-color: rgb(0 0 0 / 0.45);
  color: white;
  cursor: default;
  user-select: none;
}
</style>
