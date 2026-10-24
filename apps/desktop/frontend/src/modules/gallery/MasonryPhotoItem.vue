<script setup lang="ts">
import type { MenuItem } from '~/types/menu'
import type { Photo } from '~/types/photo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ContextMenu from '~/components/ContextMenu.vue'
import { useDeletePhoto } from '~/composables/useDeletePhoto'
import { useFileName } from '~/composables/useFileName'
import { useMovePhotos } from '~/composables/useMovePhotos'
import { useRatePhoto } from '~/composables/useRatePhoto'
import { largestCachedThumbnail, thumbnailEdgeFor, useThumbnail } from '~/composables/useThumbnail'
import { isLibraryPath } from '~/lib/library'
import { writeText } from '~/lib/native'
import { useGallery } from '~/state/gallery'
import TileCaption from './TileCaption.vue'
import TileImage from './TileImage.vue'

const { data, width, folderPath, background } = defineProps<{
  data: Photo
  width: number
  folderPath: string | null
  /** Ask for the thumbnail behind tiles on screen (see useThumbnail). */
  background: boolean
}>()

const { t } = useI18n()
const gallery = useGallery()
const { selectedPhotoIds, selectedPhotoId, filteredPhotos, bulkDeleteBlocked } = gallery

// A thumbnail at another size, from before the tiles were resized, shows
// until this size is ready. Undownloaded iCloud files get iCloud's own
// thumbnail, without a download.
const thumbnail = useThumbnail(() => folderPath, () => data.path, () => thumbnailEdgeFor(width), {
  cloud: () => data.isCloudPlaceholder,
  background: () => background,
})
const thumbnailUrl = computed(() => thumbnail.value ?? largestCachedThumbnail(folderPath, data.path))
const fileName = useFileName(() => data)
const deletePhoto = useDeletePhoto(() => folderPath)
const movePhotos = useMovePhotos(() => folderPath)
const rate = useRatePhoto(() => folderPath)

const selected = computed(() => selectedPhotoIds.value.has(data.id))
const isTabStop = computed(() => gallery.gridTabStopId.value === data.id)
const height = computed(() => width / data.aspectRatio)

function selectOnly() {
  selectedPhotoIds.value = new Set([data.id])
  selectedPhotoId.value = data.id
}

function onClick(e: MouseEvent) {
  const photos = filteredPhotos.value
  const anchorId = selectedPhotoId.value
  if (e.shiftKey && anchorId) {
    const anchorIndex = photos.findIndex(p => p.id === anchorId)
    const clickedIndex = photos.findIndex(p => p.id === data.id)
    if (anchorIndex !== -1 && clickedIndex !== -1) {
      const [start, end] = anchorIndex < clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex]
      selectedPhotoIds.value = new Set(photos.slice(start, end + 1).map(p => p.id))
      return
    }
  }
  if (e.metaKey || e.ctrlKey) {
    const next = new Set(selectedPhotoIds.value)
    if (next.has(data.id))
      next.delete(data.id)
    else
      next.add(data.id)
    selectedPhotoIds.value = next
    selectedPhotoId.value = data.id
    return
  }
  selectOnly()
}

/**
 * Selects a tile tabbed onto, so the keys that act on the selection (Space,
 * 0-5, Delete) act on the focused photo. A click's focus is left to the
 * click, which may be a ⌘/⇧ one; so is a button's inside the tile.
 */
function onFocus(e: FocusEvent) {
  const el = e.currentTarget as HTMLElement
  if (!selected.value && e.target === el && el.matches(':focus-visible'))
    selectOnly()
}

function onKeyDown(e: KeyboardEvent) {
  // Keys pressed on a button inside (iCloud download) belong to it. Space
  // (preview) is handled for the whole grid in useGridShortcuts.
  if (e.target === e.currentTarget && e.key === 'Enter')
    openPreview()
}

function openPreview() {
  gallery.setPreviewPhotoId(data.id)
}

const selectedCount = computed(() => (selected.value ? selectedPhotoIds.value.size : 1))
const targets = () => (selected.value ? filteredPhotos.value.filter(p => selectedPhotoIds.value.has(p.id)) : [data])

// After the menu has closed and handed focus back, so the card's name field keeps it.
function openInfo() {
  setTimeout(() => {
    gallery.photoInfoId.value = data.id
  }, 0)
}

const menuItems = computed<MenuItem[]>(() => {
  const count = selectedCount.value
  // Photos in the Photos library aren't files of their own to rename or move.
  const isFile = !isLibraryPath(folderPath)
  let deleteLabel = t('common.delete')
  if (count > 1)
    deleteLabel = bulkDeleteBlocked.value ? t('gallery.bulkDeleteBusy') : t('common.deletePhotos', count)
  return [
    ...(count === 1 ? [{ label: t('gallery.info'), icon: 'i-mingcute-information-line', onSelect: openInfo }] : []),
    ...(count === 1 && isFile
      ? [
          {
            label: t('gallery.rename'),
            icon: 'i-mingcute-edit-line',
            // Renaming happens in the info card.
            onSelect: () => {
              gallery.renamingPhotoId.value = data.id
              openInfo()
            },
          },
          { label: t('common.copyPath'), icon: 'i-mingcute-copy-line', onSelect: () => void writeText(data.path) },
        ]
      : []),
    ...(isFile
      ? [{
          label: count > 1 ? t('common.movePhotosTo', count) : t('gallery.moveTo'),
          icon: 'i-mingcute-move-line',
          onSelect: () => void movePhotos(targets()),
        }]
      : []),
    {
      label: deleteLabel,
      icon: 'i-mingcute-delete-2-line',
      destructive: true,
      disabled: count > 1 && bulkDeleteBlocked.value,
      onSelect: () => void deletePhoto(targets()),
    },
  ]
})

function onMenuOpenChange(open: boolean) {
  if (open && !selectedPhotoIds.value.has(data.id))
    selectOnly()
}
</script>

<template>
  <ContextMenu :items="menuItems" @open-change="onMenuOpenChange">
    <!-- eslint-disable-next-line vue-a11y/interactive-supports-focus -- the bound tabindex makes one tile the listbox's tab stop; the rule only reads literal values -->
    <div
      class="photo-tile"
      :class="{ selected }"
      :style="{ width: `${width}px`, height: `${height}px` }"
      role="option"
      :tabindex="isTabStop ? 0 : -1"
      :aria-selected="selected"
      :aria-label="fileName"
      :data-photo-id="data.id"
      @click="onClick"
      @focus="onFocus"
      @keydown="onKeyDown"
      @dblclick="openPreview"
    >
      <TileImage :photo="data" :file-name="fileName" :thumbnail-url="thumbnailUrl" :folder-path="folderPath" />
      <div class="selection-mark" />
      <TileCaption :photo="data" @rate="r => rate([data], r)" />
      <div v-if="data.rating > 0" class="rating-badge text-caption wght-semibold">
        {{ data.rating }}★
      </div>
    </div>
  </ContextMenu>
</template>

<style scoped>
.photo-tile {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-color: var(--ps-muted);
  outline: none;
  outline-offset: 6px;
}

.photo-tile:focus-visible {
  outline: 2px solid var(--ps-focus-ring);
}

/* Focus follows the selection, whose border already marks the tile. */
.photo-tile.selected:focus-visible {
  outline: none;
}

/* Like digiKam and Eagle: an accent border and a faint accent wash over the picture. */
.selection-mark {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 4px;
  background-color: rgb(107 151 255 / 0.18);
  box-shadow: inset 0 0 0 3px var(--ps-focus-ring);
  opacity: 0;
  transition: opacity 80ms;
}

.photo-tile.selected .selection-mark {
  opacity: 1;
}

/* Gives way to the caption's rating button, which shows the same. */
.rating-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  pointer-events: none;
  border-radius: 6px;
  background-color: rgb(0 0 0 / 0.6);
  padding: 2px 4px;
  color: var(--ps-rating);
  transition: opacity 80ms;
}

.photo-tile:hover .rating-badge,
.photo-tile:focus-within .rating-badge {
  opacity: 0;
}
</style>
