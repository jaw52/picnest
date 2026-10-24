<script setup lang="ts">
import type { LanguagePreference } from '~/mygo'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconButton from '~/components/IconButton.vue'
import TabsSubtle from '~/components/TabsSubtle.vue'
import TabsSubtleItem from '~/components/TabsSubtleItem.vue'
import { provideSurface, surfaceClasses } from '~/context/surface'
import { setLanguage } from '~/i18n'
import { App } from '~/mygo'
import { languageState, settingsOpen } from '~/state/settings'
import PhotoCacheRow from './PhotoCacheRow.vue'

const SURFACE_LEVEL = 3
const LANGUAGES: LanguagePreference[] = ['system', 'zh-CN', 'en']

const { t } = useI18n()
provideSurface(SURFACE_LEVEL)
const surface = surfaceClasses(SURFACE_LEVEL, 8)

// Each language is named in itself, so it can be found whatever the app is shown in.
const languageNames = computed<Record<LanguagePreference, string>>(() => ({
  'system': t('settings.system'),
  'zh-CN': '简体中文',
  'en': 'English',
}))

function pickLanguage(preference: LanguagePreference) {
  void App.setLanguage(preference).then((state) => {
    setLanguage(state.language)
    languageState.value = state
  })
}
</script>

<!-- Settings, opened from the menu bar (Picnest ▸ Settings…, ⌘,). -->
<template>
  <DialogRoot v-model:open="settingsOpen">
    <DialogPortal>
      <DialogOverlay class="dialog-backdrop" />
      <DialogContent class="dialog-popup p-5 gap-4 w-[min(440px,calc(100vw-64px))]" :class="surface" :aria-describedby="undefined">
        <div class="flex items-center justify-between">
          <DialogTitle class="text-title wght-semibold">
            {{ t('settings.title') }}
          </DialogTitle>
          <DialogClose as-child>
            <IconButton :label="t('common.close')" icon="i-mingcute-close-line" />
          </DialogClose>
        </div>
        <div class="flex gap-4 items-center justify-between">
          <span class="text-body">{{ t('settings.language') }}</span>
          <TabsSubtle
            :selected-index="Math.max(0, LANGUAGES.indexOf(languageState.preference))"
            @select="index => pickLanguage(LANGUAGES[index])"
          >
            <TabsSubtleItem v-for="(preference, index) in LANGUAGES" :key="preference" :index="index" :label="languageNames[preference]" />
          </TabsSubtle>
        </div>
        <PhotoCacheRow />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
