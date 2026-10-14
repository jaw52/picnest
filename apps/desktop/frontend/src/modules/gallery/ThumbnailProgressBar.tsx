import * as stylex from '@stylexjs/stylex'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { thumbnailProgressAtom } from '~/atoms/gallery'
import { ProgressBar } from '~/components/ProgressBar'

const styles = stylex.create({
  thin: { height: 2, borderRadius: 0 },
})

export function ThumbnailProgressBar() {
  const { t } = useTranslation()
  const { total, done } = useAtomValue(thumbnailProgressAtom)
  if (total === 0)
    return null

  return (
    <ProgressBar label={t('gallery.thumbnailProgress')} value={done} max={total} xstyle={styles.thin} />
  )
}
