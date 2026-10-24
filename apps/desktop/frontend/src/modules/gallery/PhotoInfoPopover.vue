<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed, shallowRef, watch } from 'vue'
import { useScrollContainer } from '~/context/scroll'
import { provideSurface, surfaceClasses, useSurface } from '~/context/surface'
import { useGallery } from '~/state/gallery'
import PhotoInfo from './PhotoInfo.vue'

const { photoInfoId, photos, currentFolder } = useGallery()
const scroller = useScrollContainer()

/** The photo's tile in the tab's grid: another tab may show the folder too. */
function tileOf(photoId: string) {
  return scroller.value?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(photoId)}"]`) ?? null
}

// Kept through the closing animation, so the card fades out with its content.
const shownId = shallowRef(photoInfoId.value)
watch(photoInfoId, (id) => {
  if (id !== null)
    shownId.value = id
})
const photo = computed(() => photos.value.find(p => p.id === shownId.value) ?? null)
const anchor = computed(() => (shownId.value === null ? undefined : tileOf(shownId.value) ?? undefined))

// The card closes once its tile is gone: deleted, filtered out, or scrolled
// far enough to be unmounted.
watch([photoInfoId, photo, scroller], ([id, current, scrollerEl], _, onCleanup) => {
  if (id === null)
    return
  const closeIfGone = () => {
    if (!current || !tileOf(id))
      photoInfoId.value = null
  }
  closeIfGone()
  scrollerEl?.addEventListener('scroll', closeIfGone, { passive: true })
  onCleanup(() => scrollerEl?.removeEventListener('scroll', closeIfGone))
}, { flush: 'post' })

// A card stacks two steps above the page, like a menu.
const level = Math.min(useSurface() + 2, 8)
provideSurface(level)
const surface = surfaceClasses(level, 3)

// A rename asked for from the context menu focuses its input; otherwise the
// card itself takes focus, not its first button, whose tooltip would show.
function onOpenAutoFocus(e: Event) {
  e.preventDefault()
  const card = document.querySelector<HTMLElement>('[data-photo-info]')
  const target = card?.querySelector<HTMLElement>('input') ?? card
  target?.focus()
}

function onOpenChange(open: boolean) {
  if (!open)
    photoInfoId.value = null
}
</script>

<!--
  The card beside a photo's tile, opened from its context menu or ⌘I. It
  floats over the page, so opening it leaves the grid as it is. Mount once,
  beside the grid.
-->
<template>
  <PopoverRoot :open="photoInfoId !== null" @update:open="onOpenChange">
    <PopoverAnchor v-if="anchor" :reference="anchor" />
    <PopoverPortal>
      <PopoverContent
        v-if="photo"
        side="right"
        align="start"
        :side-offset="8"
        :collision-padding="12"
        data-photo-info
        tabindex="-1"
        class="info-card"
        :class="surface"
        @open-auto-focus="onOpenAutoFocus"
      >
        <PhotoInfo :photo="photo" :folder-path="currentFolder" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
