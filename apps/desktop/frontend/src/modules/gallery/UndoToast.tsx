import * as stylex from '@stylexjs/stylex'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { undoableDeletionAtom } from '~/atoms/gallery'
import { Button } from '~/components/Button'
import { Tooltip } from '~/components/Tooltip'
import { useUndoDeletion } from '~/hooks/useDeletePhoto'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { shadows } from '~/theme/shadows.stylex'
import { text } from '~/theme/text'

/** How long the toast stays up, unless the pointer rests on it. */
const VISIBLE_MS = 6000

const styles = stylex.create({
  toast: {
    position: 'fixed',
    bottom: 20,
    left: '50%',
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.container,
    backgroundColor: colors['--ps-surface-5'],
    boxShadow: shadows['--ps-shadow-5'],
    paddingBlock: 6,
    paddingLeft: 14,
    paddingRight: 6,
    color: colors['--ps-foreground'],
    whiteSpace: 'nowrap',
  },
})

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
    if (!shown || hovered)
      return
    timerRef.current = window.setTimeout(setShown, VISIBLE_MS, null)
    return () => window.clearTimeout(timerRef.current)
  }, [shown, hovered])

  const count = shown?.trashed.length ?? 0
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          role="status"
          {...stylex.props(styles.toast, text.caption)}
          initial={{ opacity: 0, x: '-50%', y: 8 }}
          animate={{ opacity: 1, x: '-50%', y: 0 }}
          exit={{ opacity: 0, x: '-50%', y: 8, transition: spring.moderate.exit }}
          transition={spring.moderate}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <span>{count > 1 ? t('gallery.trashedMany', { count }) : t('gallery.trashedOne')}</span>
          <Tooltip content="⌘Z">
            <Button variant="secondary" size="compact" onClick={() => void undo()}>
              {t('gallery.undo')}
            </Button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
