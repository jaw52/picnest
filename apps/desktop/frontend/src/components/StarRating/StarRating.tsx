import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '~/lib/cn'
import ForbidCircleRegular from '~icons/mingcute/forbid-circle-line'
import StarFilled from '~icons/mingcute/star-fill'
import StarRegular from '~icons/mingcute/star-line'

const buttonClass =
  'rounded-sm bg-transparent p-0.5 leading-none transition-colors duration-80 outline-none focus-visible:outline-2 focus-visible:outline-accent'
// Set on the buttons: an icon's own inline color is currentColor.
const filledClass = 'text-amber'
// Outlined in the rating's own color, on the page or over a photo alike;
// the "no rating" button too, solid under the pointer.
const emptyClass = 'text-amber/70'

export interface StarRatingProps {
  /** False keeps the buttons out of the Tab order, where keys 0-5 rate already. */
  focusable?: boolean
  onChange?: (rating: number) => void
  rating: number
  size?: number
}

/**
 * Interactive 0-5 rating: a "no rating" button, then five stars. Clicking
 * the currently-set star clears it too.
 */
export function StarRating({ rating, onChange, size = 16, focusable = true }: StarRatingProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? rating
  const tabIndex = focusable ? undefined : -1

  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHovered(null)}>
      <button
        aria-label={t('rating.none')}
        aria-pressed={rating === 0}
        className={cn(buttonClass, hovered === 0 ? filledClass : emptyClass)}
        tabIndex={tabIndex}
        type="button"
        onMouseEnter={() => setHovered(0)}
        onClick={(e) => {
          e.stopPropagation()
          onChange?.(0)
        }}
      >
        <ForbidCircleRegular height={size} width={size} />
      </button>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display
        const Star = filled ? StarFilled : StarRegular
        return (
          <button
            aria-label={t('rating.stars', { count: star })}
            aria-pressed={star <= rating}
            className={cn(buttonClass, filled ? filledClass : emptyClass)}
            key={star}
            tabIndex={tabIndex}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onClick={(e) => {
              e.stopPropagation()
              onChange?.(star === rating ? 0 : star)
            }}
          >
            <Star height={size} width={size} />
          </button>
        )
      })}
    </div>
  )
}
