<script setup lang="ts">
import type { CollectItem } from '~/mygo'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { convertPreviewSrc } from '~/lib/native'

const { item } = defineProps<{ item: CollectItem }>()

const { t } = useI18n()

function fileName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  }
  catch {
    return ''
  }
}

const detail = computed(() => {
  if (item.status === 'saving')
    return t('collect.saving')
  if (item.status === 'failed')
    return t('collect.failed')
  return host(item.pageUrl) || t('collect.saved')
})
</script>

<template>
  <div class="p-1 rounded-item flex gap-2.5 items-center" :title="item.error || item.pageUrl">
    <img v-if="item.path" :src="convertPreviewSrc(item.path, 128)" alt="" class="rounded-md bg-muted shrink-0 size-10 object-cover">
    <span v-else class="text-muted-foreground rounded-md bg-muted flex shrink-0 size-10 items-center justify-center">
      <span class="i-mingcute-download-2-line size-4" />
    </span>
    <span class="flex grow flex-col min-w-0">
      <span class="text-caption truncate">{{ item.path ? fileName(item.path) : t('collect.picture') }}</span>
      <span class="text-caption truncate" :class="item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'">{{ detail }}</span>
    </span>
    <span v-if="item.status === 'saving'" class="i-mingcute-loading-3-line text-muted-foreground size-4 animate-spin" />
    <span v-else-if="item.status === 'saved'" class="i-mingcute-check-circle-line text-success size-4" />
    <span v-else-if="item.status === 'failed'" class="i-mingcute-close-circle-line text-destructive size-4" />
  </div>
</template>
