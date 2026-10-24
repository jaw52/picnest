import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { PhotoDetails } from '~/types/photo'
import { computed, reactive, shallowRef, toValue, watch } from 'vue'
import { getPhotoDetails } from '~/lib/backend'

// Module-level cache: EXIF/file-size never changes for the lifetime of the
// app, so once we've read it for a path there's no need to ask the backend again
// just because the info card closed and opened again.
const detailsCache = reactive(new Map<string, PhotoDetails>())

export function usePhotoDetails(path: MaybeRefOrGetter<string | null>): {
  details: ComputedRef<PhotoDetails | null>
  loading: Readonly<Ref<boolean>>
} {
  const loading = shallowRef(false)

  watch(() => toValue(path), (current, _, onCleanup) => {
    if (!current || detailsCache.has(current)) {
      loading.value = false
      return
    }
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    loading.value = true
    getPhotoDetails(current)
      .then((resolved) => {
        detailsCache.set(current, resolved)
      })
      .catch((error: unknown) => {
        console.warn(`failed to read photo details for ${current}:`, error)
      })
      .finally(() => {
        if (!cancelled)
          loading.value = false
      })
  }, { immediate: true })

  const details = computed(() => {
    const current = toValue(path)
    return current ? detailsCache.get(current) ?? null : null
  })
  return { details, loading }
}
