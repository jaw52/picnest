/** A smaller picture of a photo, and the photo's size, to show while the photo loads. */
export interface Placeholder {
  src: string
  width: number
  height: number
}

/** The photo itself, and its width in pixels, when `src` is a scaled copy of it. */
export interface FullImage {
  src: string
  width: number
}

/** The video of a Live Photo, and whether it plays over and over (a loop or a bounce). */
export interface LiveVideo {
  src: string
  loop: boolean
}
