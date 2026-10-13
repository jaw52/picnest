import type { RatingFilter } from '~/lib/photo'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
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
  const [filter, setRatingFilter] = useAtom(ratingFilterAtom)
  const photos = useAtomValue(photosAtom)
  const counts = ratingCounts(photos)
  const setSelectedIds = useSetAtom(selectedPhotoIdsAtom)
  const setAnchorId = useSetAtom(selectedPhotoIdAtom)
  const setPreviewId = useSetAtom(previewPhotoIdAtom)
  // A folder with no photos of its own (often one that only groups others)
  // has nothing to filter.
  const photosTotal = useAtomValue(photosTotalAtom)
  const isScanning = useAtomValue(isScanningAtom)
  const hasPhotos = photosTotal > 0 || isScanning

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
      {hasPhotos && (
        <div {...stylex.props(styles.filters)}>
          <TabsSubtle
            selectedIndex={Math.max(0, FILTERS.indexOf(filter))}
            onSelect={index => setFilter(FILTERS[index] ?? null)}
          >
            <TabsSubtleItem index={0} label={`全部 ${photos.length}`} />
            <TabsSubtleItem index={1} label={`未评分 ${counts[0]}`} />
            {STARS.map(star => (
              <TabsSubtleItem key={star} index={star + 1} label={`${star}★ ${counts[star]}`} />
            ))}
          </TabsSubtle>
        </div>
      )}
    </div>
  )
}
