export interface PhotoMeta {
  path: string
  fileName: string
  width: number
  height: number
  rating: number
  modified: number
  taken: number
  isCloudPlaceholder: boolean
  /** How a Live Photo in the library moves: once through, or over and over. */
  live?: 'live' | 'loop'
}

export interface PhotoPage {
  photos: PhotoMeta[]
  total: number
}

export interface Photo extends PhotoMeta {
  id: string
  aspectRatio: number
  thumbnailUrl?: string
}

export interface PhotoExif {
  cameraMake?: string
  cameraModel?: string
  lensModel?: string
  focalLength?: string
  aperture?: string
  shutterSpeed?: string
  iso?: string
  exposureBias?: string
  takenAt?: string
}

export interface PhotoDetails {
  fileSize: number
  created?: number
  exif?: PhotoExif
}
