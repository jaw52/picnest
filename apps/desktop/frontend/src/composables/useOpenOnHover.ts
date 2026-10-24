import type { ComputedRef } from 'vue'
import { computed, shallowRef } from 'vue'

export interface OpenOnHover {
  open: ComputedRef<boolean>
  /** Bound with `v-on` on the card. */
  handlers: {
    pointerenter: () => void
    pointerleave: () => void
    focus: (e: FocusEvent) => void
    blur: () => void
  }
}

/**
 * Whether a card's icon should be open (a folder's front tipped down, the
 * library's prints fanned out): while pointed at or focused from the keyboard.
 */
export function useOpenOnHover(): OpenOnHover {
  const hovered = shallowRef(false)
  const focused = shallowRef(false)
  return {
    open: computed(() => hovered.value || focused.value),
    handlers: {
      pointerenter: () => {
        hovered.value = true
      },
      pointerleave: () => {
        hovered.value = false
      },
      focus: (e) => {
        focused.value = (e.currentTarget as HTMLElement).matches(':focus-visible')
      },
      blur: () => {
        focused.value = false
      },
    },
  }
}
