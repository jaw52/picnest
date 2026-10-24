<script setup lang="ts">
import { computed } from 'vue'
import ContextMenu from '~/components/ContextMenu.vue'
import FolderIcon from './FolderIcon.vue'
import { folderMenuItems } from './folderMenuItems'
import { useFolderIcon } from './useFolderIcon'
import './card.css'

const { path } = defineProps<{
  path: string
  name: string
}>()
const emit = defineEmits<{ open: [], remove: [], delete: [] }>()

const { coverUrl, iCloud, open, handlers } = useFolderIcon(() => path)
const menuItems = computed(() => folderMenuItems(path, {
  onRemove: () => emit('remove'),
  onDelete: () => emit('delete'),
}))
</script>

<!-- A folder on the new-tab page, drawn like a Finder folder icon with its first photo inside. -->
<template>
  <ContextMenu :items="menuItems">
    <button type="button" class="card group" v-on="handlers" @click="emit('open')">
      <span aria-hidden="true" class="card-well">
        <FolderIcon :cover-url="coverUrl" :open="open" :i-cloud="iCloud" />
      </span>
      <span class="name text-caption">{{ name }}</span>
    </button>
  </ContextMenu>
</template>

<style scoped>
.name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  max-width: 100%;
  text-align: center;
  word-break: break-all;
}
</style>
