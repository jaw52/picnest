<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import IconButton from '~/components/IconButton.vue'
import { useFileName } from '~/composables/useFileName'
import { writeText } from '~/lib/native'
import { useGallery } from '~/state/gallery'

const { photo, renamable } = defineProps<{
  photo: Photo
  /** A photo in the Photos library has no file of its own to rename. */
  renamable: boolean
}>()
const emit = defineEmits<{ rename: [newName: string] }>()

const { t } = useI18n()
const { renamingPhotoId } = useGallery()
const isEditing = shallowRef(false)
const draft = shallowRef(photo.fileName)
const input = useTemplateRef<HTMLInputElement>('input')
const fileName = useFileName(() => photo)

function startEditing() {
  if (!renamable)
    return
  draft.value = photo.fileName
  isEditing.value = true
}

// A rename asked for from elsewhere (the grid's context menu); the request
// is cleared once editing starts.
watch(renamingPhotoId, (id) => {
  if (id === photo.id && !isEditing.value)
    startEditing()
}, { immediate: true })

watch(isEditing, async (editing) => {
  if (!editing)
    return
  renamingPhotoId.value = null
  await nextTick()
  input.value?.focus()
  input.value?.select()
})

function commit() {
  isEditing.value = false
  emit('rename', draft.value)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter')
    commit()
  else if (e.key === 'Escape')
    isEditing.value = false
}
</script>

<!-- Double-click (or 重命名 in a photo's context menu) to rename, synced to the real file on disk; click the icon to copy. -->
<template>
  <input
    v-if="isEditing"
    ref="input"
    v-model="draft"
    class="name-input text-subtitle-compact wght-semibold"
    @blur="commit"
    @keydown="onKeyDown"
  >
  <div v-else class="flex gap-1 items-center">
    <div
      role="presentation"
      class="text-subtitle-compact flex-1 min-w-0 cursor-text truncate wght-semibold"
      :title="renamable ? t('photoInfo.renameHint', { name: fileName }) : fileName"
      @dblclick="startEditing"
    >
      {{ fileName }}
    </div>
    <IconButton :label="t('photoInfo.copyFileName')" icon="i-mingcute-copy-line" class="shrink-0" @click="writeText(fileName)" />
  </div>
</template>

<style scoped>
.name-input {
  box-sizing: border-box;
  height: 28px;
  width: 100%;
  background-color: var(--ps-card);
  padding-inline: 6px;
  color: var(--ps-foreground);
  outline: none;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--ps-border);
}
</style>
