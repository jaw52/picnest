import type { Photo } from './photo'
import type { TrashedPhoto } from '~/mygo'

/** The last deletion, while it can still be undone. */
export interface UndoableDeletion {
  folderPath: string
  trashed: TrashedPhoto[]
}

export interface DeleteConfirmRequest {
  folderPath: string
  photos: Photo[]
  /** The photos the user still wants deleted, or null if they cancelled. */
  resolve: (photos: Photo[] | null) => void
}

/** How many of the folder's photos have their thumbnail ready, out of all of them. */
export interface ThumbnailProgress {
  total: number
  done: number
}
