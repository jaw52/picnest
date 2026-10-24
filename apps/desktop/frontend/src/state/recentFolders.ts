import type { RecentFolder } from '~/types/folder'
import { persisted } from './persisted'

/** The folders the user has added, listed on the new-tab page. */
export const recentFolders = persisted<RecentFolder[]>('picnest.recentFolders', [])
