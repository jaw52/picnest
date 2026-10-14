import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ForbidCircleRegular from '~icons/mingcute/forbid-circle-line'
import StarFilled from '~icons/mingcute/star-fill'
import StarRegular from '~icons/mingcute/star-line'
import { styles } from './style'

export interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: number
  /** False keeps the buttons out of the Tab order, where keys 0-5 rate already. */
  focusable?: boolean
}

/**
 * Interactive 0-5 rating: a "no rating" button, then five stars. Clicking
 * the currently-set star clears it too.
 */
export function StarRating({
  rating,
  onChange,
  size = 16,
  focusable = true,
}: StarRatingProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? rating
  const tabIndex = focusable ? undefined : -1

  return (
    <div {...stylex.props(styles.root)} onMouseLeave={() => setHovered(null)}>
      <button
        type="button"
        aria-label={t('rating.none')}
        aria-pressed={rating === 0}
        tabIndex={tabIndex}
        {...stylex.props(styles.button, hovered === 0 ? styles.filled : styles.empty)}
        onMouseEnter={() => setHovered(0)}
        onClick={(e) => {
          e.stopPropagation()
          onChange?.(0)
        }}
      >
        <ForbidCircleRegular width={size} height={size} />
      </button>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display
        const Star = filled ? StarFilled : StarRegular
        return (
          <button
            key={star}
            type="button"
            aria-label={t('rating.stars', { count: star })}
            aria-pressed={star <= rating}
            tabIndex={tabIndex}
            {...stylex.props(styles.button, filled ? styles.filled : styles.empty)}
            onMouseEnter={() => setHovered(star)}
            onClick={(e) => {
              e.stopPropagation()
              onChange?.(star === rating ? 0 : star)
            }}
          >
            <Star width={size} height={size} />
          </button>
        )
      })}
    </div>
  )
}
