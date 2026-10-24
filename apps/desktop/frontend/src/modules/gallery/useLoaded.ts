import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, shallowRef, toValue } from 'vue'

export interface Loaded {
  loaded: ComputedRef<boolean>
  onLoad: (e: Event) => void
  onError: () => void
}

/**
 * Whether `src` has loaded (or failed to: the placeholder then gives way, to
 * show that it failed). The photo's own element reports it, so the load is
 * the one that paints.
 */
export function useLoaded(src: MaybeRefOrGetter<string>): Loaded {
  const loadedSrc = shallowRef<string | null>(null)
  const done = (of: string) => {
    loadedSrc.value = of
  }
  return {
    loaded: computed(() => loadedSrc.value === toValue(src)),
    // Decoded off the main thread before it shows: shown as soon as it
    // loads, a large photo would decode on it (decoding="sync") and hold up
    // the page, a switch to the next photo included.
    onLoad: (e) => {
      const of = toValue(src)
      void (e.currentTarget as HTMLImageElement).decode().catch(() => {}).then(() => done(of))
    },
    onError: () => done(toValue(src)),
  }
}
