import type { Dispatch, SetStateAction } from 'react'
import type { Photo } from '../shared/types.ts'
import type { Ratings } from './ratings.ts'
import { memo, useCallback, useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react'
import { DEFAULT_COLUMN_WIDTH, filterPhotos, FILTERS, idAfterDelete, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from '../shared/gallery.ts'
import { Grid } from './Grid.tsx'
import { Preview } from './Preview.tsx'

interface GalleryProps {
  index: number
  active: boolean
  photos: Photo[]
  setPhotos: Dispatch<SetStateAction<Photo[]>>
  ratings: Ratings
}

function ignore() {
  return () => {}
}

export const Gallery = memo(({ index, active, photos, setPhotos, ratings }: GalleryProps) => {
  const [filter, setFilter] = useState(0)
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH)
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Only a filtered grid follows every rating; otherwise a rating is its tile's business.
  const ratingsVersion = useSyncExternalStore(filter ? ratings.subscribeAll : ignore, () => (filter ? ratings.version : 0))
  const filtered = useMemo(
    () => filterPhotos(photos, filter, ratings.get),
    [photos, filter, ratings, ratingsVersion],
  )
  const previewIndex = previewId === null ? -1 : filtered.findIndex(p => p.id === previewId)

  const rate = useCallback((id: string, rating: number) => ratings.set(id, rating), [ratings])
  const toggle = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev)
      if (!next.delete(id))
        next.add(id)
      return next
    })
  }, [])

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (previewIndex !== -1) {
      const current = filtered[previewIndex]
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const to = filtered[previewIndex + (e.key === 'ArrowRight' ? 1 : -1)]
        if (to)
          setPreviewId(to.id)
      }
      else if (e.key === 'Escape') {
        setPreviewId(null)
      }
      else if (e.key === 'Backspace') {
        setPreviewId(idAfterDelete(filtered, previewIndex))
        setPhotos(prev => prev.filter(p => p.id !== current.id))
      }
      else if (e.key >= '1' && e.key <= '5') {
        rate(current.id, Number(e.key))
      }
      return
    }
    if (e.key === 'a' && e.metaKey) {
      e.preventDefault()
      setSelection(new Set(filtered.map(p => p.id)))
    }
    else if (e.key === 'Escape') {
      setSelection(new Set())
    }
  })
  useEffect(() => {
    if (!active)
      return
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  return (
    <div className="gallery" data-tab={index}>
      <div className="toolbar">
        {FILTERS.map(f => (
          <button key={f} type="button" data-filter={f || 'all'} className={f === filter ? 'active' : ''} onClick={() => setFilter(f)}>
            {f ? `≥ ${f}★` : 'All'}
          </button>
        ))}
        <input
          className="width"
          type="range"
          min={MIN_COLUMN_WIDTH}
          max={MAX_COLUMN_WIDTH}
          value={columnWidth}
          onInput={e => setColumnWidth(Number(e.currentTarget.value))}
          onChange={() => {}}
        />
        <span className="count">
          {filtered.length}
          {' '}
          photos
        </span>
      </div>
      <Grid photos={filtered} columnWidth={columnWidth} selection={selection} onOpen={setPreviewId} onRate={rate} onToggle={toggle} ratings={ratings} />
      {previewIndex !== -1 && <Preview photos={filtered} index={previewIndex} onPick={setPreviewId} />}
    </div>
  )
})
