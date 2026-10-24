<script setup lang="ts">
import { computed } from 'vue'
import ContextMenu from '~/components/ContextMenu.vue'
import FolderIcon from './FolderIcon.vue'
import { folderMenuItems } from './folderMenuItems'
import { useFolderIcon } from './useFolderIcon'

const { path, width, height } = defineProps<{
  path: string
  name: string
  width: number
  height: number
}>()
const emit = defineEmits<{
  /** Opens the folder in place, or in a background tab for ⌘ and middle clicks. */
  open: [e: { metaKey: boolean, button: number }]
  delete: []
}>()

const { coverUrl, iCloud, open, handlers } = useFolderIcon(() => path)
const menuItems = computed(() => folderMenuItems(path, {
  onOpenInNewTab: () => emit('open', { metaKey: true, button: 0 }),
  onDelete: () => emit('delete'),
}))
</script>

<!-- A subfolder in the masonry, sized like a photo tile, that opens like a link. -->
<template>
  <ContextMenu :items="menuItems">
    <!-- The middle button never fires a click; it is a new tab, as on a link,
         and pressing it would otherwise start autoscroll. -->
    <button
      type="button"
      class="tile"
      :style="{ width: `${width}px`, height: `${height}px` }"
      v-on="handlers"
      @click="emit('open', $event)"
      @auxclick="$event.button === 1 && emit('open', $event)"
      @mousedown="$event.button === 1 && $event.preventDefault()"
    >
      <!-- The icon takes this much of the tile's width, scaling with the column. -->
      <span aria-hidden="true" class="w-[56%]">
        <FolderIcon :cover-url="coverUrl" :open="open" :i-cloud="iCloud" fluid />
      </span>
      <span class="text-caption max-w-full truncate">{{ name }}</span>
    </button>
  </ContextMenu>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-inline: 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--ps-foreground);
  background-color: var(--ps-muted);
  outline: none;
  outline-offset: 6px;
  transition: background-color 80ms;
}

.tile:hover {
  background-color: var(--ps-hover);
}

.tile:focus-visible {
  outline: 2px solid var(--ps-focus-ring);
}
</style>
