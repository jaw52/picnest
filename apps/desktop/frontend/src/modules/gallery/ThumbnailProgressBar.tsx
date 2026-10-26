import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'

import { thumbnailProgressAtom } from '~/atoms/gallery'
import { ProgressBar } from '~/components/ProgressBar'

export function ThumbnailProgressBar() {
  const { t } = useTranslation()
  const { total, done } = useAtomValue(thumbnailProgressAtom)
  if (total === 0) return null

  return <ProgressBar className="h-0.5 rounded-none" label={t('gallery.thumbnailProgress')} max={total} value={done} />
}
