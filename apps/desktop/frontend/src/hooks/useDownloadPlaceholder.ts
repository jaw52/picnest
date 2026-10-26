import { atom, useStore } from 'jotai'
import { useCallback } from 'react'

import { currentFolderAtom, photosAtom } from '~/atoms/gallery'
import { i18n } from '~/i18n'
import { downloadPlaceholder } from '~/lib/backend'
import { message } from '~/lib/native'
import type { Photo } from '~/types/photo'

import { useOpenFolder } from './useOpenFolder'

/** Ids of photos whose iCloud download was requested and hasn't landed yet. */
export const downloadingIdsAtom = atom<ReadonlySet<string>>(new Set<string>())

const POLL_MS = 2000
const MAX_POLLS = 30

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Starts an iCloud download for a placeholder tile and re-scans until the
 * file is real (the backend returns as soon as the request is accepted).
 */
export function useDownloadPlaceholder(folderPath: string | null) {
  const store = useStore()
  const { refreshFolder } = useOpenFolder()

  return useCallback(
    async (photo: Photo) => {
      if (!folderPath || store.get(downloadingIdsAtom).has(photo.id)) return
      const setDownloading = (on: boolean) =>
        store.set(downloadingIdsAtom, (prev) => {
          const next = new Set(prev)
          if (on) next.add(photo.id)
          else next.delete(photo.id)
          return next
        })

      setDownloading(true)
      try {
        await downloadPlaceholder(photo.path)
        for (let i = 0; i < MAX_POLLS; i++) {
          await sleep(POLL_MS)
          if (store.get(currentFolderAtom) !== folderPath) return
          await refreshFolder(folderPath)
          const current = store.get(photosAtom).find((p) => p.id === photo.id)
          if (!current || !current.isCloudPlaceholder) return
        }
      } catch (error) {
        await message(i18n.t('dialogs.downloadFailed', { error }), {
          title: i18n.t('dialogs.downloadTitle'),
          kind: 'error',
        })
      } finally {
        setDownloading(false)
      }
    },
    [folderPath, store, refreshFolder],
  )
}
