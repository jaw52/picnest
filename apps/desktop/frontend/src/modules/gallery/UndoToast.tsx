import { useAtomValue } from 'jotai'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { undoableDeletionAtom } from '~/atoms/gallery'
import { Button } from '~/components/Button'
import { Tooltip } from '~/components/Tooltip'
import { useUndoDeletion } from '~/hooks/useDeletePhoto'
import { cn } from '~/lib/cn'
import { spring } from '~/lib/springs'
import { popupSurface } from '~/lib/surface'

/** How long the toast stays up, unless the pointer rests on it. */
const VISIBLE_MS = 6000

/**
 * "Moved to the trash · Undo", for a few seconds after a deletion. ⌘Z undoes
 * it too, for as long as it is the last deletion (see useUndoShortcut).
 */
export function UndoToast() {
  const { t } = useTranslation()
  const deletion = useAtomValue(undoableDeletionAtom)
  const undo = useUndoDeletion()
  const [shown, setShown] = useState(deletion)
  const [hovered, setHovered] = useState(false)
  const timerRef = useRef(0)

  // Each new deletion shows the toast afresh; undoing hides it.
  const [lastDeletion, setLastDeletion] = useState(deletion)
  if (deletion !== lastDeletion) {
    setLastDeletion(deletion)
    setShown(deletion)
  }

  useEffect(() => {
    if (!shown || hovered) return
    timerRef.current = window.setTimeout(setShown, VISIBLE_MS, null)
    return () => window.clearTimeout(timerRef.current)
  }, [shown, hovered])

  const count = shown?.trashed.length ?? 0
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          animate={{ opacity: 1, x: '-50%', y: 0 }}
          exit={{ opacity: 0, x: '-50%', y: 8, transition: spring.moderate.exit }}
          initial={{ opacity: 0, x: '-50%', y: 8 }}
          role="status"
          transition={spring.moderate}
          className={cn(
            popupSurface,
            'fixed bottom-5 left-1/2 z-60 flex items-center gap-3 rounded-container py-1.5 pr-1.5 pl-3.5 text-caption whitespace-nowrap',
          )}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <span>{count > 1 ? t('gallery.trashedMany', { count }) : t('gallery.trashedOne')}</span>
          <Tooltip content="⌘Z">
            <Button variant="secondary" onClick={() => void undo()}>
              {t('gallery.undo')}
            </Button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
