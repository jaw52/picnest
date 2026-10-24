import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { OpenOnHover } from '~/composables/useOpenOnHover'
import { useIsICloudFolder } from '~/composables/useIsICloudFolder'
import { useOpenOnHover } from '~/composables/useOpenOnHover'
import { useFolderCover } from './useFolderCover'

export interface FolderIconState extends OpenOnHover {
  /** The cover photo's thumbnail, once there is one. */
  coverUrl: ComputedRef<string | undefined>
  /** Whether the folder is in iCloud Drive; undefined until known. */
  iCloud: ComputedRef<boolean | undefined>
}

/** What a folder's icon shows: its cover photo, an iCloud cloud, and whether it is open under the pointer. */
export function useFolderIcon(path: MaybeRefOrGetter<string>): FolderIconState {
  return { coverUrl: useFolderCover(path), iCloud: useIsICloudFolder(path), ...useOpenOnHover() }
}
