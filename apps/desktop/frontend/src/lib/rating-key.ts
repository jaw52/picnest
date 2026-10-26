/**
 * The rating a bare 0-5 key press stands for, or null when the event isn't
 * one (other keys, modifiers, or typing into a text field).
 */
export function ratingFromKey(e: KeyboardEvent): number | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return null
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return null
  return /^[0-5]$/.test(e.key) ? Number(e.key) : null
}
