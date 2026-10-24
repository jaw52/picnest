<script setup lang="ts">
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { resetKey } = defineProps<{
  /**
   * Changing this shows the content again, giving the user a way to retry
   * (e.g. switching folder or filter) instead of being stuck on the error
   * screen forever.
   */
  resetKey?: unknown
}>()

const { t } = useI18n()
const error = shallowRef<Error | null>(null)

watch(() => resetKey, () => {
  error.value = null
})

onErrorCaptured((cause) => {
  console.error('Picnest crashed while rendering:', cause)
  error.value = cause instanceof Error ? cause : new Error(String(cause))
  return false
})
</script>

<!-- Shows what went wrong in place of content that failed to render, instead of a blank page. -->
<template>
  <div v-if="error" class="p-6 text-center flex flex-col gap-2 h-full items-center justify-center">
    <p class="text-subtitle-compact text-destructive wght-semibold">
      {{ t('errorBoundary.title') }}
    </p>
    <p class="text-caption text-muted-foreground max-w-112">
      {{ error.message }}
    </p>
    <p class="text-caption text-muted-foreground">
      {{ t('errorBoundary.hint') }}
    </p>
  </div>
  <slot v-else />
</template>
