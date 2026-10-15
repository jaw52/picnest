import type { RatingFilter } from '~/lib/photo'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  isScanningAtom,
  photosAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  ratingFilterAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { TabsSubtle, TabsSubtleItem } from '~/components/TabsSubtle'
import { ratingCounts } from '~/lib/photo'
import { colors } from '~/theme/colors.stylex'

import { PathBar } from './PathBar'

const styles = stylex.create({
  bar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 4,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors['--ps-border'],
    paddingInline: 12,
    paddingBlock: 6,
  },
  // The rating filters sit at the right end, after the path.
  filters: { marginLeft: 'auto' },
})

const STARS = [1, 2, 3, 4, 5]
// Tab order: 全部 (null), 未评分 (0), then 1-5 stars.
const FILTERS: RatingFilter[] = [null, 0, ...STARS]

export function FilterBar() {
  const { t } = useTranslation()
  const [filter, setRatingFilter] = useAtom(ratingFilterAtom)
  const photos = useAtomValue(photosAtom)
  const counts = ratingCounts(photos)
  // While pages are still loading, the backend's count, rather than one
  // climbing a page at a time.
  const isScanning = useAtomValue(isScanningAtom)
  const photosTotal = useAtomValue(photosTotalAtom)
  const allCount = isScanning ? Math.max(photosTotal, photos.length) : photos.length
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const setAnchorId = useSetAtom(selectedPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)

  // Changing which photos are visible invalidates the current selection -
  // clear it rather than leaving stale/hidden ids selected.
  const setFilter = useCallback(
    (value: RatingFilter) => {
      setRatingFilter(value)
      setSelectedIds(new Set())
      setAnchorId(null)
      setPreviewId(null)
    },
    [setRatingFilter, setSelectedIds, setAnchorId, setPreviewId],
  )

  return (
    <div {...stylex.props(styles.bar)}>
      <PathBar />
      <div {...stylex.props(styles.filters)}>
        <TabsSubtle
          selectedIndex={Math.max(0, FILTERS.indexOf(filter))}
          onSelect={index => setFilter(FILTERS[index] ?? null)}
        >
          <TabsSubtleItem index={0} label={t('gallery.filterAll', { count: allCount })} />
          <TabsSubtleItem index={1} label={t('gallery.filterUnrated', { count: counts[0] })} dimmed={counts[0] === 0} />
          {STARS.map(star => (
            <TabsSubtleItem
              key={star}
              index={star + 1}
              label={`${star}★ ${counts[star]}`}
              dimmed={counts[star] === 0}
            />
          ))}
        </TabsSubtle>
      </div>
    </div>
  )
}
