<script setup lang="ts">
import type { AnimationPlaybackControls } from 'motion-v'
import type { PageDirection, SwipePager } from '~/lib/swipe-pager'
import type { MenuItem } from '~/types/menu'
import type { Photo } from '~/types/photo'
import { useEventListener, useWindowSize } from '@vueuse/core'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion-v'
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StarRating from '~/components/StarRating.vue'
import { useDecodedImages } from '~/composables/useDecodedImages'
import { useDeletePhoto } from '~/composables/useDeletePhoto'
import { useFileName } from '~/composables/useFileName'
import { useRatePhoto } from '~/composables/useRatePhoto'
import { useTabActive } from '~/context/tab'
import { isLibraryPath } from '~/lib/library'
import { convertFileSrc, convertLiveSrc, convertPreviewSrc, writeText } from '~/lib/native'
import { ratingFromKey } from '~/lib/rating-key'
import { spring } from '~/lib/springs'
import { createSwipePager } from '~/lib/swipe-pager'
import { useGallery } from '~/state/gallery'
import CloudCaption from './CloudCaption.vue'
import CloudPreview from './CloudPreview.vue'
import Filmstrip from './Filmstrip.vue'
import LightboxButton from './LightboxButton.vue'
import LightboxNeighbour from './LightboxNeighbour.vue'
import { placeholderFor } from './lightboxPlaceholder'
import ZoomableImage from './ZoomableImage.vue'

/** Space between the photo and its neighbours as they slide past. */
const PAGE_GAP = 32
/** A swipe turns the page once it has gone this far, in px, or a fifth of the window. */
const PAGE_TURN_DISTANCE = 200
const SLIDE = { type: 'spring' as const, duration: 0.32, bounce: 0 }
/** How long a switch waits for a library photo before showing its thumbnail. */
const LIBRARY_SWITCH_WAIT_MS = 120
/** Steps the preview size goes up in, so a slightly larger window doesn't load every photo again. */
const PREVIEW_EDGE_STEP = 512

function slideTransition() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? { duration: 0 } : SLIDE
}

const { t } = useI18n()
const gallery = useGallery()
const { previewPhotos: photos, previewPhoto: photo, currentFolder: folderPath } = gallery
const fileName = useFileName(photo)
const deletePhoto = useDeletePhoto(folderPath)
const rate = useRatePhoto(folderPath)
const active = useTabActive()

// Closing selects the photo last shown in the grid, which takes the focus.
const close = () => gallery.closePreview()

// Move focus into the lightbox while it's open; on close the grid focuses
// the photo last shown (see closePreview).
const overlay = useTemplateRef<{ $el: HTMLElement }>('overlay')
const isOpen = computed(() => photo.value !== null)
watch(isOpen, async (open) => {
  if (!open)
    return
  await nextTick()
  overlay.value?.$el.focus()
})

// The lightbox fades its photo in when it opens, but swaps photos in place
// after that: fading each one in would blink the backdrop through.
const openedId = shallowRef<string | null>(null)
watch(() => photo.value?.id ?? null, (id) => {
  if (id === null)
    openedId.value = null
  else if (openedId.value === null)
    openedId.value = id
}, { immediate: true, flush: 'sync' })

const index = computed(() => (photo.value ? photos.value.findIndex(p => p.id === photo.value!.id) : -1))

/**
 * The size photos are shown at fit, which follows the window: the pixels on
 * its longest side on this display. A photo larger than that is shown from a
 * copy scaled to it: WebKit stalls the page for 100ms or more to paint a
 * photo of 12 megapixels or more, even one decoded beforehand.
 */
const windowSize = useWindowSize()
const edge = computed(() => {
  const longest = Math.max(windowSize.width.value, windowSize.height.value) * window.devicePixelRatio
  return Math.ceil(longest / PREVIEW_EDGE_STEP) * PREVIEW_EDGE_STEP
})
const srcOf = (p: Photo) => convertPreviewSrc(p.path, edge.value)

// Neighbours are decoded in the background, and a switch waits for the next
// photo to decode, so the current one stays up until the next can paint.
const { decode, retain, isDecoded } = useDecodedImages()
watch([index, photos, edge], ([i, shown]) => {
  if (i === -1) {
    retain([])
    return
  }
  const srcs = [shown[i - 1], shown[i], shown[i + 1]]
    .filter(p => p !== undefined && !p.isCloudPlaceholder)
    .map(p => srcOf(p))
  retain(srcs)
  for (const src of srcs)
    void decode(src)
}, { immediate: true })

// How far the photo and its neighbours are slid, by a swipe in progress.
const slide = useMotionValue(0)
let sliding: AnimationPlaybackControls | null = null
function slideTo(x: number) {
  sliding?.stop()
  sliding = animate(slide, x, slideTransition())
  return sliding
}

// Only the latest switch lands, should several be waiting on decodes.
let switchToken = 0
// A swipe's page turn is sliding the next photo in.
let turning = false
// The track goes back in place before the new photo paints, so the
// neighbour slid into view is swapped for the same photo, unmoved. Closing
// mid-slide leaves it in place for the next opening too.
watch(() => photo.value?.id, () => {
  turning = false
  sliding?.stop()
  slide.jump(0)
}, { flush: 'post' })

function ready(next: Photo): Promise<unknown> {
  if (next.isCloudPlaceholder)
    return Promise.resolve()
  const full = decode(srcOf(next))
  if (!isLibraryPath(folderPath.value))
    return full
  // A photo in the Photos library may take a while to read: the switch
  // waits only briefly for it (a neighbour is decoded already), then goes
  // ahead on its thumbnail.
  const placeholder = placeholderFor(folderPath.value, next)
  const fallback = new Promise<void>(resolve => setTimeout(resolve, LIBRARY_SWITCH_WAIT_MS))
    .then(() => placeholder && decode(placeholder.src))
  return Promise.race([full, fallback])
}

function goTo(delta: number) {
  const next = index.value === -1 ? undefined : photos.value[index.value + delta]
  if (next === undefined)
    return
  const token = ++switchToken
  void ready(next).then(() => {
    if (switchToken === token)
      gallery.setPreviewPhotoId(next.id)
  })
}

// A swipe's page turn: the neighbour finishes sliding in, then lands.
function turnPage(direction: PageDirection) {
  const next = photos.value[index.value + direction]
  if (next === undefined)
    return
  const token = ++switchToken
  turning = true
  const slid = slideTo(-direction * (window.innerWidth + PAGE_GAP)).finished
  void Promise.all([ready(next), slid]).then(() => {
    if (switchToken === token)
      gallery.setPreviewPhotoId(next.id)
  })
}

// Two-finger horizontal swipe, the photo following the fingers. Lives here
// rather than in ZoomableImage because that remounts with every photo,
// which would lose track of the gesture mid-momentum.
let pager: SwipePager | null = null
onBeforeUnmount(() => pager?.dispose())
function onWheel(e: WheelEvent) {
  if (e.ctrlKey)
    return
  pager ??= createSwipePager({
    distance: () => Math.min(PAGE_TURN_DISTANCE, window.innerWidth / 5),
    canPage: direction => index.value !== -1 && photos.value[index.value + direction] !== undefined,
    follow: (offset) => {
      sliding?.stop()
      slide.set(offset)
    },
    commit: turnPage,
    turning: () => turning,
    release: () => void slideTo(0),
  })
  pager.push(e)
}

// Listening only while open: the key press that opened it (Space, in the
// grid) must not reach it too, and close it again.
useEventListener(() => (isOpen.value && active.value ? window : null), 'keydown', (e: KeyboardEvent) => {
  const current = photo.value
  if (!current)
    return
  // Space closes it too, as Quick Look does in Finder.
  switch (e.key) {
    case 'Escape':
    case ' ': {
      e.preventDefault()
      if (!e.repeat)
        close()
      break
    }
    case 'ArrowLeft': {
      goTo(-1)
      break
    }
    case 'ArrowRight': {
      goTo(1)
      break
    }
    case 'Delete':
    case 'Backspace': {
      e.preventDefault()
      if (!e.repeat)
        void deletePhoto([current])
      break
    }
    default: {
      const rating = ratingFromKey(e)
      if (rating !== null)
        rate([current], rating)
    }
  }
})

const previous = computed(() => (index.value > 0 ? photos.value[index.value - 1] : undefined))
const next = computed(() => (index.value !== -1 ? photos.value[index.value + 1] : undefined))

const menuItems = computed<MenuItem[]>(() => {
  const current = photo.value
  if (!current)
    return []
  return [
    isLibraryPath(folderPath.value)
      // Not a file of its own to point at.
      ? { label: t('photoInfo.copyFileName'), icon: 'i-mingcute-copy-line', onSelect: () => void writeText(fileName.value) }
      : { label: t('common.copyPath'), icon: 'i-mingcute-copy-line', onSelect: () => void writeText(current.path) },
    { label: t('common.delete'), icon: 'i-mingcute-delete-2-line', destructive: true, onSelect: () => void deletePhoto([current]) },
  ]
})

/** Shown from a scaled copy, the photo itself loads for a closer look. */
const full = computed(() => {
  const current = photo.value
  return current && Math.max(current.width, current.height) > edge.value
    ? { src: convertFileSrc(current.path), width: current.width }
    : undefined
})
const live = computed(() => {
  const current = photo.value
  return current?.live ? { src: convertLiveSrc(current.path, current.modified), loop: current.live === 'loop' } : undefined
})
</script>

<template>
  <AnimatePresence>
    <motion.div
      v-if="photo"
      ref="overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="fileName"
      tabindex="-1"
      class="outline-none bg-black/90 flex items-center inset-0 justify-center fixed z-50 overflow-hidden"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      :exit="{ opacity: 0, transition: spring.slow.exit }"
      :transition="spring.slow"
      @click="close"
      @wheel="onWheel"
    >
      <!-- The photo and its neighbours side by side, slid along by a swipe. -->
      <motion.div class="inset-0 absolute" :style="{ x: slide }">
        <div v-if="previous" class="page before">
          <LightboxNeighbour :photo="previous" :folder-path="folderPath" :src="srcOf(previous)" />
        </div>
        <div class="page">
          <CloudPreview v-if="photo.isCloudPlaceholder" :photo="photo" :folder-path="folderPath" />
          <!-- A photo already decoded shows straight away, without its
               thumbnail and spinner blinking up first. -->
          <ZoomableImage
            v-else
            :key="photo.id"
            :src="srcOf(photo)"
            :full="full"
            :placeholder="isDecoded(srcOf(photo)) ? undefined : placeholderFor(folderPath, photo)"
            :live="live"
            :alt="fileName"
            :fade-in="photo.id === openedId"
            :menu-items="menuItems"
          />
        </div>
        <div v-if="next" class="page after">
          <LightboxNeighbour :photo="next" :folder-path="folderPath" :src="srcOf(next)" />
        </div>
      </motion.div>
      <LightboxButton :label="t('common.close')" icon="i-mingcute-close-line" class="right-4 top-4" @click="close" />
      <LightboxButton
        v-if="previous"
        :label="t('preview.previous')"
        icon="i-mingcute-left-line"
        class="left-4 top-1/2 -translate-y-1/2"
        @click.stop="goTo(-1)"
      />
      <LightboxButton
        v-if="next"
        :label="t('preview.next')"
        icon="i-mingcute-right-line"
        class="right-4 top-1/2 -translate-y-1/2"
        @click.stop="goTo(1)"
      />
      <!-- Above the filmstrip. As wide as its content, up to the window: a
           long file name gives way (it ellipsizes) instead of squeezing the
           count onto two lines. -->
      <div class="caption text-caption" role="presentation" @click.stop>
        <span class="min-w-0 truncate">{{ fileName }}</span>
        <span v-if="index !== -1" class="text-white/60 shrink-0 whitespace-nowrap tabular-nums">{{ `${index + 1} / ${photos.length}` }}</span>
        <span class="flex shrink-0">
          <StarRating :rating="photo.rating" :size="14" @change="r => rate([photo!], r)" />
        </span>
        <CloudCaption v-if="photo.isCloudPlaceholder" :photo="photo" :folder-path="folderPath" />
      </div>
      <Filmstrip
        v-if="index !== -1"
        :photos="photos"
        :index="index"
        :folder-path="folderPath"
        @select="i => goTo(i - index)"
      />
    </motion.div>
  </AnimatePresence>
</template>

<style scoped>
.page {
  position: absolute;
  inset: 0;
  display: flex;
}

.before {
  transform: translateX(calc(-100% - 32px));
}

.after {
  transform: translateX(calc(100% + 32px));
}

.caption {
  position: absolute;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 32px);
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 8px;
  background-color: rgb(255 255 255 / 0.1);
  padding: 4px 12px;
  color: rgb(255 255 255 / 0.8);
}
</style>
