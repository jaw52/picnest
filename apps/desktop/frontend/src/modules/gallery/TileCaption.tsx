import type { Photo } from '~/types/photo'
import { StarFilled } from '@mingcute/react/core-filled'
import { StarRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StarRating } from '~/components/StarRating'
import { colors } from '~/theme/colors.stylex'
import { motion } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'
import { tileMarker } from './markers.stylex'

const styles = stylex.create({
  // Revealed while the tile is hovered. On a gradient, so it stays legible
  // on any photo.
  caption: {
    position: 'absolute',
    insetInline: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingInline: 8,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundImage: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)',
    opacity: {
      default: 0,
      [stylex.when.ancestor(':hover', tileMarker)]: 1,
      [stylex.when.ancestor(':focus-within', tileMarker)]: 1,
    },
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
  },
  row: { display: 'flex', maxWidth: '100%', alignItems: 'center', gap: 4 },
  fileName: { minWidth: 0, pointerEvents: 'none', color: 'rgb(255 255 255 / 0.9)' },
  ratingButton: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: 2,
    height: 20,
    paddingInline: 4,
    borderRadius: 4,
    cursor: 'pointer',
    color: colors['--ps-rating'],
    backgroundColor: { 'default': 'rgb(255 255 255 / 0.12)', ':hover': 'rgb(255 255 255 / 0.24)' },
    transitionProperty: 'background-color',
    transitionDuration: motion.fast,
  },
  // The stars' row, folded to no height until the rating button is hovered.
  fold: {
    display: 'grid',
    gridTemplateRows: '0fr',
    transitionProperty: 'grid-template-rows',
    transitionDuration: motion.fast,
  },
  unfolded: { gridTemplateRows: '1fr' },
  foldInner: { minHeight: 0, overflow: 'hidden' },
  stars: { paddingTop: 4 },
})

interface TileCaptionProps {
  photo: Photo
  onRate: (rating: number) => void
}

/**
 * The file name over the bottom of a tile, and beside it a button showing
 * the rating. Hovering that button unfolds a row under the name to rate the
 * photo with: "no rating", then 1-5 stars.
 */
export function TileCaption({ photo, onRate }: TileCaptionProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(false)

  return (
    <div
      {...stylex.props(styles.caption)}
      onMouseLeave={() => setRating(false)}
      // A double-click here is a slow rating, not a request to preview.
      onDoubleClick={e => e.stopPropagation()}
    >
      <div {...stylex.props(styles.row)}>
        <span {...stylex.props(utility.truncate, styles.fileName, text.caption)}>
          {photo.fileName}
        </span>
        <button
          type="button"
          aria-label={t('rating.label')}
          aria-expanded={rating}
          // The tile is the grid's tab stop; keys 0-5 rate from there.
          tabIndex={-1}
          {...stylex.props(styles.ratingButton, text.caption, weight.semibold)}
          onMouseEnter={() => setRating(true)}
          onClick={(e) => {
            e.stopPropagation()
            setRating(open => !open)
          }}
        >
          {photo.rating > 0
            ? (
                <>
                  <StarFilled size={12} />
                  {photo.rating}
                </>
              )
            : <StarRegular size={12} />}
        </button>
      </div>
      <div {...stylex.props(styles.fold, rating && styles.unfolded)}>
        <div {...stylex.props(styles.foldInner)} inert={!rating}>
          <div {...stylex.props(styles.stars)}>
            <StarRating
              rating={photo.rating}
              onChange={onRate}
              size={16}
              focusable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
