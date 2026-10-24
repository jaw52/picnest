<script setup lang="ts">
import type { GridLayout } from './gridLayout'
import type { GridDirection } from '~/lib/masonry'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { trashFolder } from '~/composables/trashFolder'
import { useBottomPull } from '~/composables/useBottomPull'
import { useGridShortcuts } from '~/composables/useGridShortcuts'
import { useOpenFolder } from '~/composables/useOpenFolder'
import { hasCachedThumbnail, thumbnailCacheKey, thumbnailEdgeFor } from '~/composables/useThumbnail'
import { useThumbnailPinch } from '~/composables/useThumbnailPinch'
import { useThumbnailPrefetch } from '~/composables/useThumbnailPrefetch'
import { useScrollContainer } from '~/context/scroll'
import { useTabActive } from '~/context/tab'
import { formatPeriod } from '~/lib/format'
import { cellsInRange, neighborCell } from '~/lib/masonry'
import FolderTile from '~/modules/tabs/FolderTile.vue'
import { photoGrouping, thumbnailWidth, useGallery } from '~/state/gallery'
import { openFromClick } from '~/state/tabs'
import { anchorShift, COLUMN_GUTTER, gridHeaderBottom, GROUP_HEADER_HEIGHT, layOutGrid, sameInputs, slideTiles } from './gridLayout'
import MasonryPhotoItem from './MasonryPhotoItem.vue'
import OverscrollArc from './OverscrollArc.vue'

/** Scroll position granularity; finer steps re-render the grid for nothing. */
const SCROLL_STEP = 100
/** Room kept between a revealed photo and the edges of the visible grid. */
const REVEAL_MARGIN = 12

const { t } = useI18n()
const gallery = useGallery()
const { filteredPhotos: photos, subfolders, currentFolder: folderPath, isScanning, photosTotal, ratingFilter } = gallery
const { refreshFolder } = useOpenFolder()
const scroller = useScrollContainer()
const active = useTabActive()

// The grid lays itself out from the photos' aspect ratios, so it only needs
// the container's width; the tab's scroller is what scrolls.
const container = useTemplateRef<HTMLElement>('container')
const containerWidth = shallowRef(0)
const hasItems = computed(() => subfolders.value.length + photos.value.length > 0)
useResizeObserver(container, ([entry]) => {
  containerWidth.value = entry.contentRect.width
})

// Laid out again whenever an input changes. A photo rated out of the filter
// or deleted reflows the grid, the tiles sliding over.
const grid = computed<GridLayout>((previous) => {
  const inputs = {
    subfolders: subfolders.value,
    photos: photos.value,
    containerWidth: containerWidth.value,
    columnWidth: thumbnailWidth.value,
    folderPath: folderPath.value,
    ratingFilter: ratingFilter.value,
    grouping: photoGrouping.value,
  }
  return previous && sameInputs(previous.inputs, inputs) ? previous : layOutGrid(inputs, previous)
})
const layout = computed(() => grid.value.layout)

// Keeps the tile at the top of the scroller where it was when the grid is
// laid out again around it, so what's on screen doesn't jump away, and
// slides the tiles that moved.
watch(grid, (current) => {
  const el = container.value
  const scrollerEl = scroller.value
  if (!el || !scrollerEl)
    return
  // In grid coordinates; at the very top, new photos show up above.
  const shown = scrollerEl.getBoundingClientRect().top - el.getBoundingClientRect().top
  const shift = shown > 0 ? anchorShift(current, shown) : 0
  if (shift !== 0)
    scrollerEl.scrollBy({ top: shift })
  if (current.slide)
    slideTiles(el, current, shift)
}, { flush: 'post' })

const thumbnailEdge = computed(() => thumbnailEdgeFor(layout.value.columnWidth))
useThumbnailPrefetch(folderPath, () => (containerWidth.value > 0 ? thumbnailEdge.value : 0))

// Which part of the grid the tab's scroller shows, in grid coordinates.
// Tracked in SCROLL_STEP increments, so scrolling re-renders a few times per
// screen rather than every frame.
const viewport = shallowRef({ top: 0, height: window.innerHeight })
watch([scroller, hasItems], ([scrollerEl], _, onCleanup) => {
  if (!scrollerEl)
    return
  let frame = 0
  function update() {
    frame = 0
    const el = container.value
    if (!el || !scrollerEl)
      return
    const shown = scrollerEl.getBoundingClientRect().top - el.getBoundingClientRect().top
    const top = Math.floor(shown / SCROLL_STEP) * SCROLL_STEP
    const height = scrollerEl.clientHeight
    if (viewport.value.top !== top || viewport.value.height !== height)
      viewport.value = { top, height }
  }
  function schedule() {
    if (!frame)
      frame = requestAnimationFrame(update)
  }
  schedule()
  scrollerEl.addEventListener('scroll', schedule, { passive: true })
  const observer = new ResizeObserver(schedule)
  observer.observe(scrollerEl)
  onCleanup(() => {
    cancelAnimationFrame(frame)
    scrollerEl.removeEventListener('scroll', schedule)
    observer.disconnect()
  })
}, { immediate: true, flush: 'post' })

function inRange(top: number) {
  return top >= viewport.value.top - viewport.value.height && top <= viewport.value.top + SCROLL_STEP + viewport.value.height * 2
}

// Mount a screen above and below the visible part, so fast scrolling with
// 1000+ photos never shows blank gaps.
const visible = computed(() => cellsInRange(
  layout.value.cells,
  viewport.value.top - viewport.value.height,
  viewport.value.top + SCROLL_STEP + viewport.value.height * 2,
))

/** The groups' headers shown; their sections come after the subfolders', if there are any. */
const headers = computed(() => {
  const { groups } = grid.value
  const grouping = photoGrouping.value
  if (containerWidth.value === 0 || grouping === null)
    return []
  const { headerTops } = layout.value
  return groups
    .map((group, g) => ({ key: group.start, top: headerTops[g + headerTops.length - groups.length], label: formatPeriod(group.start, grouping) }))
    .filter(header => inRange(header.top))
})

const tiles = computed(() => {
  if (containerWidth.value === 0)
    return []
  const offset = subfolders.value.length
  return visible.value.map((i) => {
    const cell = layout.value.cells[i]
    if (i < offset)
      return { kind: 'folder' as const, cell, tile: grid.value.tiles[i], folder: subfolders.value[i] }
    const photo = photos.value[i - offset]
    // The window's top is somewhere in the SCROLL_STEP below viewport.top.
    const onScreen = cell.top < viewport.value.top + SCROLL_STEP + viewport.value.height
      && cell.top + cell.height > viewport.value.top
    // A tile off screen asks for its thumbnail behind those on screen. One
    // that has its thumbnail keeps the flag as it is, so scrolling past
    // doesn't render it again.
    const background = !onScreen
      && !hasCachedThumbnail(thumbnailCacheKey(folderPath.value, photo.path, thumbnailEdge.value, photo.isCloudPlaceholder))
    return { kind: 'photo' as const, cell, tile: photo.id, photo, background }
  })
})

// Arrow keys: from a photo to its neighbour, or from no selection to the
// first photo on screen.
function neighbor(id: string | null, direction: GridDirection) {
  const offset = subfolders.value.length
  const shownPhotos = photos.value
  const cells = layout.value.cells
  const from = id === null ? -1 : shownPhotos.findIndex(p => p.id === id)
  if (from === -1) {
    // In grid coordinates, the first line not hidden under the bars.
    const shownFrom = gridHeaderBottom(scroller.value) - (container.value?.getBoundingClientRect().top ?? 0)
    const onScreen = visible.value
      .filter(i => i >= offset && cells[i].top >= shownFrom)
      .toSorted((a, b) => cells[a].top - cells[b].top || a - b)[0]
    return shownPhotos[(onScreen ?? offset) - offset]?.id
  }
  const candidates = shownPhotos.map((_, i) => offset + i)
  const to = neighborCell(cells, offset + from, direction, candidates)
  return to === undefined ? undefined : shownPhotos[to - offset].id
}
useGridShortcuts(neighbor)
useThumbnailPinch(() => active.value && gallery.previewPhotoId.value === null)
const pull = useBottomPull(() => active.value && gallery.previewPhotoId.value === null && hasItems.value, scroller)

// Brings a photo into view - scrolling only as far as needed - and moves
// focus to it once its tile is mounted (it may be off in the virtualized
// part of the grid until the scroll lands).
let pendingFocus: string | null = null
function focusPending() {
  const tile = pendingFocus === null
    ? null
    : container.value?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(pendingFocus)}"]`)
  if (tile) {
    tile.focus({ preventScroll: true })
    pendingFocus = null
  }
}
watch(gallery.revealPhoto, async (reveal) => {
  if (!reveal)
    return
  gallery.revealPhoto.value = null
  // Once the grid has laid out what changed with the request.
  await nextTick()
  const index = photos.value.findIndex(p => p.id === reveal.id)
  const el = container.value
  const scrollerEl = scroller.value
  if (index === -1 || !el || !scrollerEl)
    return
  // In viewport coordinates.
  const cell = layout.value.cells[subfolders.value.length + index]
  const top = el.getBoundingClientRect().top + cell.top
  const visibleTop = gridHeaderBottom(scrollerEl) + REVEAL_MARGIN
  const visibleBottom = scrollerEl.getBoundingClientRect().bottom - REVEAL_MARGIN
  if (top < visibleTop)
    scrollerEl.scrollBy({ top: top - visibleTop })
  else if (top + cell.height > visibleBottom)
    scrollerEl.scrollBy({ top: Math.min(top - visibleTop, top + cell.height - visibleBottom) })
  pendingFocus = reveal.id
  focusPending()
})
// A tile scrolled to from afar mounts once the grid catches up with the scroll.
watch(visible, focusPending, { flush: 'post' })

function deleteSubfolder(path: string) {
  void trashFolder(path).then(() => {
    if (folderPath.value)
      void refreshFolder(folderPath.value)
  })
}
</script>

<!--
  The open folder's subfolders, then its photos, in one masonry. A subfolder
  opens in place, like a link; the rating filter only narrows the photos. No
  folder yet means the tab's folder is still being scanned (the new-tab page
  replaces this view otherwise).
-->
<template>
  <template v-if="hasItems">
    <div
      ref="container"
      role="listbox"
      :aria-label="t('gallery.photos')"
      aria-multiselectable="true"
      class="relative"
      :style="{ height: `${layout.height}px` }"
    >
      <h2
        v-for="header in headers"
        :key="header.key"
        class="text-body text-foreground flex items-center inset-x-0 absolute wght-semibold"
        :style="{ top: `${header.top}px`, height: `${GROUP_HEADER_HEIGHT - COLUMN_GUTTER}px` }"
      >
        {{ header.label }}
      </h2>
      <div
        v-for="item in tiles"
        :key="item.kind === 'folder' ? item.folder.path : item.photo.id"
        :data-tile="item.tile"
        class="absolute"
        :style="{ top: `${item.cell.top}px`, left: `${item.cell.left}px` }"
      >
        <FolderTile
          v-if="item.kind === 'folder'"
          :path="item.folder.path"
          :name="item.folder.name"
          :width="layout.columnWidth"
          :height="item.cell.height"
          @open="e => openFromClick(item.folder.path, e)"
          @delete="deleteSubfolder(item.folder.path)"
        />
        <MasonryPhotoItem
          v-else
          :data="item.photo"
          :width="layout.columnWidth"
          :folder-path="folderPath"
          :background="item.background"
        />
      </div>
    </div>
    <OverscrollArc :pull="pull" />
  </template>
  <div
    v-else-if="folderPath && !isScanning"
    class="text-body text-muted-foreground flex min-h-[60vh] items-center justify-center"
  >
    {{ photosTotal === 0 ? t('gallery.emptyFolder') : t('gallery.noMatches') }}
  </div>
</template>
