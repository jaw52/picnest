<script setup lang="ts">
import type { LibraryAccess } from '~/mygo'
import { useEventListener } from '@vueuse/core'
import { animate, useMotionValue, useReducedMotion } from 'motion-v'
import { computed, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpenOnHover } from '~/composables/useOpenOnHover'
import { ensureThumbnailUrl, libraryAccess, openLibraryPrivacySettings, requestLibraryAccess, scanFolderPage } from '~/lib/backend'
import { LIBRARY_PATH } from '~/lib/library'
import { spring } from '~/lib/springs'
import { openInNewTab } from '~/state/tabs'
import { FAN, H, W } from './libraryGeometry'
import LibraryPrint from './LibraryPrint.vue'
import './card.css'

/** Thumbnail edge for the fanned photos: small, and shared with nothing else. */
const PREVIEW_EDGE = 256

const { t } = useI18n()
const { open, handlers } = useOpenOnHover()

/*
 * Where the app stands with the Photos library: whether it may be read, and
 * if so how many photos it has and the newest few to show. Access is
 * checked again when the window comes back to the front, since it is
 * granted in System Settings.
 */
const access = shallowRef<LibraryAccess>()
const total = shallowRef<number>()
const coverUrls = shallowRef<string[]>([])

async function refresh() {
  const current = await libraryAccess()
  access.value = current
  if (current !== 'granted')
    return
  const page = await scanFolderPage(LIBRARY_PATH, 0, FAN.length)
  total.value = page.total
  const urls = await Promise.all(
    page.photos.map(p => ensureThumbnailUrl(LIBRARY_PATH, p.path, PREVIEW_EDGE).catch(() => undefined)),
  )
  coverUrls.value = urls.filter(url => url !== undefined)
}

function load() {
  void refresh().catch((error: unknown) => console.warn('failed to read the Photos library:', error))
}
load()
useEventListener(window, 'focus', load)

// The prints fan out further while pointed at.
const spread = useMotionValue(0)
const reduceMotion = useReducedMotion()
watch(open, (isOpen, _, onCleanup) => {
  const target = isOpen ? 1 : 0
  if (reduceMotion.value) {
    spread.set(target)
    return
  }
  const controls = animate(spread, target, spring.slow)
  onCleanup(() => controls.stop())
})

// Clips, gradients and filters are looked up by document-wide id, inside
// url(#...) references - keep only characters that are safe there.
const id = `library${useId().replaceAll(/[^\w-]/g, '')}`
// The newest photo goes in front.
const ordered = computed(() => {
  const urls = access.value === 'granted' ? coverUrls.value : []
  return [urls[2], urls[1], urls[0]]
})

const status = computed(() => {
  if (access.value === 'granted')
    return total.value === undefined ? '' : t('library.photos', total.value)
  if (access.value === 'denied')
    return t('library.denied')
  return access.value === undefined ? '' : t('library.allowAccess')
})

/**
 * Opens the library in a tab once it may be read; before that, asks for
 * access, or, refused, opens System Settings to grant it there.
 */
async function activate() {
  if (access.value === 'denied') {
    await openLibraryPrivacySettings()
    return
  }
  const granted = access.value === 'granted' ? access.value : await requestLibraryAccess()
  access.value = granted
  if (granted !== 'granted')
    return
  openInNewTab(LIBRARY_PATH)
  void refresh()
}

function onClick() {
  void activate().catch((error: unknown) => console.warn('failed to open the Photos library:', error))
}
</script>

<!-- The Photos library on the new-tab page, drawn as three prints fanned out, its latest photos on them once it may be read. -->
<template>
  <button type="button" class="card" v-on="handlers" @click="onClick">
    <span aria-hidden="true" class="card-well">
      <svg :viewBox="`0 0 ${W} ${H}`" class="h-[84px] w-[104px] block overflow-visible">
        <defs>
          <filter :id="`${id}shadow`" x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="0.75" stdDeviation="1" flood-opacity="0.3" />
          </filter>
        </defs>
        <LibraryPrint v-for="(print, i) in FAN" :id="id" :key="print.name" :index="i" :spread="spread" :cover-url="ordered[i]" />
      </svg>
    </span>
    <span class="flex flex-col gap-px max-w-full items-center">
      <span class="text-caption">{{ t('library.name') }}</span>
      <span v-if="status" class="text-caption text-muted-foreground text-center">{{ status }}</span>
    </span>
  </button>
</template>
