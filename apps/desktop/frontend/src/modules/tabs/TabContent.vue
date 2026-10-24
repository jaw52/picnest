<script setup lang="ts">
import type { Tab } from '~/types/tabs'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import ErrorBoundary from '~/components/ErrorBoundary.vue'
import { useUndoShortcut } from '~/composables/useDeletePhoto'
import { provideScrollContainer } from '~/context/scroll'
import DeleteConfirmDialog from '~/modules/gallery/DeleteConfirmDialog.vue'
import FilterBar from '~/modules/gallery/FilterBar.vue'
import FolderControls from '~/modules/gallery/FolderControls.vue'
import MasonryView from '~/modules/gallery/MasonryView.vue'
import PhotoInfoPopover from '~/modules/gallery/PhotoInfoPopover.vue'
import PhotoPreview from '~/modules/gallery/PhotoPreview.vue'
import ThumbnailProgressBar from '~/modules/gallery/ThumbnailProgressBar.vue'
import UndoToast from '~/modules/gallery/UndoToast.vue'
import { useGallery } from '~/state/gallery'
import NewTabPage from './NewTabPage.vue'
import { useTabSync } from './useTabSync'

const { tab, active } = defineProps<{
  tab: Tab
  active: boolean
}>()

const gallery = useGallery()
useTabSync(() => tab.path)
useUndoShortcut()

const scroller = useTemplateRef<HTMLElement>('scroller')
provideScrollContainer(scroller)
/** Where the tab's page was scrolled to, kept while it is hidden. */
let scrollTop = 0

function onScroll(e: Event) {
  const el = e.currentTarget as HTMLElement
  // Not as hiding the tab drops its page's scroll position.
  if (el.clientHeight > 0)
    scrollTop = el.scrollTop
}

// Hiding a tab takes its page out of the layout, which forgets how far it
// was scrolled: put it back as the tab shows again.
watch(() => active, async (shown) => {
  if (!shown)
    return
  await nextTick()
  if (scroller.value)
    scroller.value.scrollTop = scrollTop
})

// Another folder starts at its top.
watch(gallery.currentFolder, () => {
  scrollTop = 0
  if (scroller.value)
    scroller.value.scrollTop = 0
}, { flush: 'post' })

// Switching folder or filter is a way out of the error screen.
const errorKey = computed(() => `${gallery.currentFolder.value}:${gallery.ratingFilter.value}`)
</script>

<!--
  What a tab shows: its folder's grid, or the new-tab page, scrolling on its
  own. It keeps its folder up to date, shown or not (see useTabSync).
-->
<template>
  <div v-show="active">
    <!-- Each tab scrolls on its own, under the tab bar. -->
    <div ref="scroller" class="overscroll-none [scrollbar-gutter:stable] inset-0 absolute overflow-y-auto" @scroll="onScroll">
      <NewTabPage v-if="tab.path === null" />
      <template v-else>
        <div data-grid-header class="bg-background top-0 sticky z-10">
          <FilterBar />
          <ThumbnailProgressBar />
        </div>
        <main class="p-3">
          <ErrorBoundary :reset-key="errorKey">
            <MasonryView />
          </ErrorBoundary>
        </main>
      </template>
    </div>
    <PhotoInfoPopover />
    <PhotoPreview />
    <DeleteConfirmDialog />
    <UndoToast />
    <!-- The active tab puts its folder's controls in the tab bar. -->
    <Teleport v-if="active" defer to="#folder-controls">
      <FolderControls />
    </Teleport>
  </div>
</template>
