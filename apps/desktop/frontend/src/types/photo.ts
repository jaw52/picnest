export interface PhotoMeta {
  fileName: string
  height: number
  isCloudPlaceholder: boolean
  /** How a Live Photo in the library moves: once through, or over and over. */
  live?: 'live' | 'loop'
  modified: number
  path: string
  rating: number
  taken: number
  width: number
}

export interface PhotoPage {
  photos: PhotoMeta[]
  total: number
}

export interface Photo extends PhotoMeta {
  aspectRatio: number
  id: string
  thumbnailUrl?: string
}

interface PhotoExif {
  aperture?: string
  cameraMake?: string
  cameraModel?: string
  exposureBias?: string
  focalLength?: string
  iso?: string
  lensModel?: string
  shutterSpeed?: string
  takenAt?: string
}

export interface PhotoDetails {
  created?: number
  exif?: PhotoExif
  fileSize: number
}
