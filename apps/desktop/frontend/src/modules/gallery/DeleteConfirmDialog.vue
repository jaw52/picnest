<script setup lang="ts">
import type { DeleteConfirmRequest } from '~/types/gallery'
import type { Photo } from '~/types/photo'
import { AlertDialogCancel, AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle } from 'reka-ui'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '~/components/BaseButton.vue'
import { provideSurface, surfaceClasses } from '~/context/surface'
import { useGallery } from '~/state/gallery'
import DeleteConfirmGrid from './DeleteConfirmGrid.vue'

const SURFACE_LEVEL = 3

const { t } = useI18n()
const { deleteConfirmRequest } = useGallery()
provideSurface(SURFACE_LEVEL)
const surface = surfaceClasses(SURFACE_LEVEL, 8)

// Keeps the last request on screen while the popup animates out; starts
// over when a new request reuses the mounted popup.
const shown = shallowRef<DeleteConfirmRequest | null>(deleteConfirmRequest.value)
const remaining = shallowRef<Photo[]>(shown.value?.photos ?? [])
watch(deleteConfirmRequest, (request) => {
  if (request && request !== shown.value) {
    shown.value = request
    remaining.value = request.photos
  }
})

function close(photos: Photo[] | null) {
  deleteConfirmRequest.value?.resolve(photos)
  deleteConfirmRequest.value = null
}

function onOpenChange(open: boolean) {
  if (!open)
    close(null)
}

function keep(photo: Photo) {
  remaining.value = remaining.value.filter(p => p.id !== photo.id)
}
</script>

<!-- Final confirmation for deleting photos, one or many. Focus starts on the harmless choice, not the first tile's remove button. -->
<template>
  <AlertDialogRoot :open="deleteConfirmRequest !== null" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-backdrop" />
      <AlertDialogContent class="dialog-popup max-h-[calc(100vh-96px)] w-[min(880px,calc(100vw-64px))]" :class="surface">
        <template v-if="shown">
          <div class="px-5 pb-3 pt-5 flex flex-col gap-1">
            <AlertDialogTitle class="text-title wght-semibold">
              {{ t('common.deletePhotos', remaining.length) }}
            </AlertDialogTitle>
          </div>
          <DeleteConfirmGrid :photos="remaining" :folder-path="shown.folderPath" @remove="keep" />
          <div class="px-5 pb-5 pt-3 flex gap-2 justify-end">
            <AlertDialogCancel as-child>
              <BaseButton variant="tertiary">
                {{ t('common.cancel') }}
              </BaseButton>
            </AlertDialogCancel>
            <BaseButton variant="destructive" :disabled="remaining.length === 0" @click="close(remaining)">
              {{ t('deleteConfirm.confirm') }}
            </BaseButton>
          </div>
        </template>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
