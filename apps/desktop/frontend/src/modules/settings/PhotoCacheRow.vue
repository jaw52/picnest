<script setup lang="ts">
import type { CacheClearProgress } from '~/mygo'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '~/components/BaseButton.vue'
import ProgressRing from '~/components/ProgressRing.vue'
import { clearThumbnailCache } from '~/composables/useThumbnail'
import { folderRoots } from '~/lib/folders'
import { formatFileSize } from '~/lib/format'
import { App, events } from '~/mygo'
import { recentFolders } from '~/state/recentFolders'

type CacheState = 'idle' | 'clearing' | 'cleared'

const { t } = useI18n()
// The added folders' subfolders are measured and cleared with them.
const folders = computed(() => folderRoots(recentFolders.value).map(f => f.path))
const size = shallowRef<number | null>(null)
const state = shallowRef<CacheState>('idle')
const progress = shallowRef<CacheClearProgress>({ done: 0, total: 0 })

watch(folders, (paths, _, onCleanup) => {
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  void App.photoCacheSize(paths).then((bytes) => {
    if (!cancelled)
      size.value = bytes
  })
}, { immediate: true })

async function clear() {
  if (state.value !== 'idle')
    return
  state.value = 'clearing'
  progress.value = { done: 0, total: 0 }
  const off = events.cacheClearProgress.on((next) => {
    progress.value = next
  })
  try {
    await App.clearPhotoCache(folders.value)
    clearThumbnailCache()
    size.value = await App.photoCacheSize(folders.value)
    state.value = 'cleared'
  }
  catch (error) {
    console.warn('failed to clear the photo cache:', error)
    state.value = 'idle'
  }
  finally {
    off()
  }
}

const percent = computed(() => (progress.value.total > 0 ? Math.floor(progress.value.done / progress.value.total * 100) : 0))
</script>

<!-- The photo cache's size, with a button to clear it. Mounted while Settings is open, so each opening measures afresh. -->
<template>
  <div class="flex gap-4 items-center justify-between">
    <div class="flex flex-col gap-0.5">
      <span class="flex gap-2 items-baseline">
        <span class="text-body">{{ t('settings.cache') }}</span>
        <span class="text-caption text-muted-foreground">{{ size === null ? t('settings.cacheMeasuring') : formatFileSize(size) }}</span>
      </span>
      <span class="text-caption text-muted-foreground">{{ t('settings.cacheHint') }}</span>
    </div>
    <!-- The progress shows in the button itself, which keeps focus and its place in the row. -->
    <BaseButton variant="secondary" size="compact" class="shrink-0" :disabled="state === 'cleared' || size === 0" @click="clear">
      <span v-if="state === 'clearing'" class="flex gap-1.5 items-center tabular-nums">
        <ProgressRing :label="t('settings.clearingCache')" :value="progress.done" :max="progress.total" :size="14" />
        {{ percent }}%
      </span>
      <template v-else>
        {{ state === 'cleared' ? t('settings.cacheCleared') : t('settings.clearCache') }}
      </template>
    </BaseButton>
  </div>
</template>
