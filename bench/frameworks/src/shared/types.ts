export interface Photo {
  id: string
  name: string
  /** Width over height. */
  aspectRatio: number
  rating: number
  /** Empty when the run has images turned off; tiles then show a flat color. */
  thumb: string
  full: string
  hue: number
}

/** What the harness can call on one tab's gallery, registered by each framework's app. */
export interface TabApi {
  /** Replaces the tab's photos, as opening a folder does. */
  load: (photos: Photo[]) => void
  /** Adds photos at the end, as a folder scan streaming in does. */
  append: (photos: Photo[]) => void
}

