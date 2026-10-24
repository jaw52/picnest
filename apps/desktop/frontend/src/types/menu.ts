/** A row of a context or dropdown menu. */
export interface MenuItem {
  label: string
  /** Tells rows apart when labels can repeat, as two folders' names can. */
  id?: string
  /** A UnoCSS icon class, such as `i-mingcute-copy-line`. */
  icon?: string
  /** Tints the row red, for actions that remove files. */
  destructive?: boolean
  disabled?: boolean
  /** A key combination that does the same, shown at the row's end (e.g. ⌘W). */
  shortcut?: string
  onSelect: () => void
}
