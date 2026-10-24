/** A browser-style tab. `path: null` is the new-tab page (add / pick a folder). */
export interface Tab {
  id: string
  path: string | null
  /** Folders this tab showed before, most recent last. */
  back: string[]
  /** Folders gone back from, most recent last; cleared by opening a new one. */
  forward: string[]
  /** The tab this one was ⌘-clicked open from, which keeps a run of them in order. */
  openerId?: string
}

export interface TabsState {
  tabs: Tab[]
  activeId: string
}
