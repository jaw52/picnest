import type { Ref } from 'vue'
import { StorageSerializers, useLocalStorage } from '@vueuse/core'

/**
 * Window-wide state kept in the webview's localStorage, which survives app
 * restarts. Read on creation, so its first value is already the stored one;
 * replaced, never mutated in place.
 */
export function persisted<T>(key: string, initial: T): Ref<T> {
  return useLocalStorage<T>(key, initial, { serializer: StorageSerializers.object, shallow: true })
}
