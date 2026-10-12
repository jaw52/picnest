import * as stylex from '@stylexjs/stylex'
import { useAtomValue } from 'jotai'
import { thumbnailProgressAtom } from '~/atoms/gallery'
import { ProgressBar } from '~/components/ProgressBar'

const styles = stylex.create({
  thin: { height: 2, borderRadius: 0 },
})

export function ThumbnailProgressBar() {
  const { total, done } = useAtomValue(thumbnailProgressAtom)
  if (total === 0)
    return null

  return (
    <ProgressBar label="缩略图生成进度" value={done} max={total} xstyle={styles.thin} />
  )
}
