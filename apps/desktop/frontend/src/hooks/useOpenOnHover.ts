import { useState } from 'react'

/**
 * Whether a card's icon should be open (a folder's front tipped down, the
 * library's prints fanned out): while pointed at or focused from the keyboard.
 */
export function useOpenOnHover() {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  return {
    open: hovered || focused,
    handlers: {
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(':focus-visible')),
      onBlur: () => setFocused(false),
    },
  }
}
