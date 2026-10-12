import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { currentFolderAtom } from '~/atoms/gallery'

import { listen } from '~/lib/native'

/**
 * Silently rescans the currently open folder when the backend reports it
 * changed on disk, so files added/removed/renamed outside the app (Finder,
 * another process, a sync client) show up without the user needing to
 * notice staleness and hit the manual refresh button. The backend already
 * debounces bursts of raw filesystem events (see `watcher.go`) into a single
 * `folder-changed` emission, so there's no need to debounce again here.
 */
export function useFolderWatcher(onChange: () => void) {
  const folder = useAtomValue(currentFolderAtom)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!folder)
      return

    let cancelled = false
    let unlisten: (() => void) | undefined

    listen<string>('folder-changed', (event) => {
      if (event.payload === folder)
        onChangeRef.current()
    }).then((fn) => {
      if (cancelled) {
        fn()
        return
      }
      unlisten = fn
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [folder])
}
