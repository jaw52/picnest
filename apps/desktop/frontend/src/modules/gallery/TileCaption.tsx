import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StarRating } from '~/components/StarRating'
import { useFileName } from '~/hooks/useFileName'
import { cn } from '~/lib/cn'
import type { Photo } from '~/types/photo'
import StarFilled from '~icons/mingcute/star-fill'
import StarRegular from '~icons/mingcute/star-line'

interface TileCaptionProps {
  onRate: (rating: number) => void
  photo: Photo
}

/**
 * The file name over the bottom of a tile, and beside it a button showing
 * the rating. Hovering that button unfolds a row under the name to rate the
 * photo with: "no rating", then 1-5 stars.
 */
export function TileCaption({ photo, onRate }: TileCaptionProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(false)
  const fileName = useFileName(photo)

  return (
    <div
      // Revealed while the tile is hovered. On a gradient, so it stays legible
      // on any photo.
      className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-linear-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 opacity-0 transition-opacity duration-80 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100"
      onMouseLeave={() => setRating(false)}
      // A double-click here is a slow rating, not a request to preview.
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex max-w-full items-center gap-1">
        <span className="pointer-events-none min-w-0 truncate text-caption text-white/90">{fileName}</span>
        <button
          aria-label={t('rating.label')}
          className="wght-semibold flex h-5 shrink-0 items-center gap-0.5 rounded-sm bg-white/10 px-1 text-caption text-amber transition-colors duration-80 hover:bg-white/25"
          type="button"
          onMouseEnter={() => setRating(true)}
          onClick={(e) => {
            e.stopPropagation()
            setRating((open) => !open)
          }}
          aria-expanded={rating}
          // The tile is the grid's tab stop; keys 0-5 rate from there.
          tabIndex={-1}
        >
          {photo.rating > 0 ? (
            <>
              <StarFilled height={12} width={12} />
              {photo.rating}
            </>
          ) : (
            <StarRegular height={12} width={12} />
          )}
        </button>
      </div>
      {/* The stars' row, folded to no height until the rating button is hovered. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-80',
          rating ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!rating}>
          <div className="pt-1">
            <StarRating focusable={false} rating={photo.rating} size={16} onChange={onRate} />
          </div>
        </div>
      </div>
    </div>
  )
}
