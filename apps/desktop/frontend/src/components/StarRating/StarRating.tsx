import * as stylex from '@stylexjs/stylex'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { styles } from './style'

export interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: number
  /** Drawn over a photo: empty stars stay light whatever the theme. */
  onImage?: boolean
}

/** Interactive 0-5 star rating. Clicking the currently-set star clears it. */
export function StarRating({ rating, onChange, size = 16, onImage = false }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? rating

  return (
    <div {...stylex.props(styles.root)} onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} 星`}
            aria-pressed={star <= rating}
            {...stylex.props(styles.button)}
            onMouseEnter={() => setHovered(star)}
            onClick={(e) => {
              e.stopPropagation()
              onChange?.(star === rating ? 0 : star)
            }}
          >
            <Star
              size={size}
              strokeWidth={1.5}
              fill={filled ? 'currentColor' : 'none'}
              {...stylex.props(
                styles.star,
                filled ? styles.filled : onImage ? styles.emptyOnImage : styles.empty,
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
