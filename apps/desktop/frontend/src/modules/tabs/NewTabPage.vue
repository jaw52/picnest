<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { trashFolder } from '~/composables/trashFolder'
import { useSize } from '~/context/size'
import { withFolderForgotten } from '~/lib/folders'
import { recentFolders } from '~/state/recentFolders'
import { addFolder, openInNewTab } from '~/state/tabs'
import FolderCard from './FolderCard.vue'
import LibraryCard from './LibraryCard.vue'
import './card.css'

const { t } = useI18n()
const size = useSize()

/** Only forgets the shortcut; tabs showing it stay open. */
function forget(path: string) {
  recentFolders.value = withFolderForgotten(recentFolders.value, path)
}
</script>

<!--
  What an empty tab shows: the Photos library, and the folders added before
  with a way to add another. Each opens in its own tab, so this page stays
  open.
-->
<template>
  <div class="px-4 pb-8 pt-18 flex justify-center">
    <div class="flex flex-col gap-10 max-w-[760px] w-full">
      <section class="flex flex-col gap-3">
        <h2 class="text-muted-foreground m-0 wght-semibold" :class="size.type.caption">
          {{ t('newTab.library') }}
        </h2>
        <div class="cards">
          <LibraryCard />
        </div>
      </section>
      <section class="flex flex-col gap-3">
        <h2 class="text-muted-foreground m-0 wght-semibold" :class="size.type.caption">
          {{ t('newTab.folders') }}
        </h2>
        <div class="cards">
          <FolderCard
            v-for="folder in recentFolders"
            :key="folder.path"
            :path="folder.path"
            :name="folder.name"
            @open="openInNewTab(folder.path)"
            @remove="forget(folder.path)"
            @delete="trashFolder(folder.path)"
          />
          <!-- A placeholder at the end of the folders that adds another one. -->
          <button type="button" class="card" @click="addFolder">
            <span aria-hidden="true" class="add-well">
              <span class="i-mingcute-add-line size-6" />
            </span>
            <span class="flex flex-col gap-px items-center">
              <span class="text-caption">{{ t('newTab.addFolder') }}</span>
              <span class="text-caption text-muted-foreground">{{ t('newTab.dropHint') }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Pull the cards' own padding out to the column edge. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 4px;
  margin-inline: -8px;
}

/* Sits where a folder icon would, so the grid's rows line up. */
.add-well {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: content-box;
  width: 102px;
  height: 82px;
  margin: 8px;
  border: 1px dashed var(--ps-border);
  border-radius: 12px;
  color: var(--ps-muted-foreground);
  background-color: transparent;
  transition:
    background-color 80ms,
    border-color 80ms,
    color 80ms;
}

.card:hover .add-well {
  border-color: var(--ps-muted-foreground);
  color: var(--ps-foreground);
  background-color: var(--ps-hover);
}
</style>
