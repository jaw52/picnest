import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import {
  isScanningAtom,
  photoGroupingAtom,
  photosAtom,
  photosTotalAtom,
  previewPhotoIdAtom,
  ratingFilterAtom,
  selectedPhotoIdAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { TabsSubtle, TabsSubtleItem } from '~/components/TabsSubtle'
import type { PhotoGrouping, RatingFilter } from '~/lib/photo'
import { ratingCounts } from '~/lib/photo'

import { PathBar } from './PathBar'

const STARS = [1, 2, 3, 4, 5]
// Tab order: 全部 (null), 未评分 (0), then 1-5 stars.
const FILTERS: RatingFilter[] = [null, 0, ...STARS]
const GROUPINGS: PhotoGrouping[] = [null, 'year', 'month', 'day']
const GROUPING_LABELS = {
  none: 'gallery.groupNone',
  year: 'gallery.groupYear',
  month: 'gallery.groupMonth',
  day: 'gallery.groupDay',
} as const

export function FilterBar() {
  const { t } = useTranslation()
  const [filter, setRatingFilter] = useAtom(ratingFilterAtom)
  const [grouping, setGrouping] = useAtom(photoGroupingAtom)
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5">
      <PathBar />
      {/* The grouping and the rating filters sit at the right end, after the path. */}
      <div className="ml-auto flex flex-wrap items-center gap-x-3">
        {/* By when the photos were taken, the newest first. */}
        <TabsSubtle
          selectedIndex={Math.max(0, GROUPINGS.indexOf(grouping))}
          onSelect={(index) => setGrouping(GROUPINGS[index] ?? null)}
        >
          {GROUPINGS.map((value, index) => (
            <TabsSubtleItem index={index} key={value ?? 'none'} label={t(GROUPING_LABELS[value ?? 'none'])} />
          ))}
        </TabsSubtle>
        <TabsSubtle
          selectedIndex={Math.max(0, FILTERS.indexOf(filter))}
          onSelect={(index) => setFilter(FILTERS[index] ?? null)}
        >
          <TabsSubtleItem index={0} label={t('gallery.filterAll', { count: allCount })} />
          <TabsSubtleItem dimmed={counts[0] === 0} index={1} label={t('gallery.filterUnrated', { count: counts[0] })} />
          {STARS.map((star) => (
            <TabsSubtleItem
              dimmed={counts[star] === 0}
              index={star + 1}
              key={star}
              label={`${star}★ ${counts[star]}`}
            />
          ))}
        </TabsSubtle>
      </div>
    </div>
  )
}
