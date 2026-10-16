import type { Photo } from '../shared/types.ts'
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { DEFAULT_COLUMN_WIDTH, filterPhotos, FILTERS, idAfterDelete, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from '../shared/gallery.ts'
import { Grid } from './Grid.tsx'
import { Preview } from './Preview.tsx'

export function Gallery(props: { index: number, active: boolean }) {
  // The list as one signal of plain photos (no store proxies over
  // thousands of them); changed ratings in a store by id, so rating a
  // photo updates its stars and nothing else.
  const [photos, setPhotos] = createSignal<Photo[]>([])
  const [ratings, setRatings] = createStore<Record<string, number>>({})
  const [filter, setFilter] = createSignal(0)
  const [columnWidth, setColumnWidth] = createSignal(DEFAULT_COLUMN_WIDTH)
  const [selection, setSelection] = createSignal<ReadonlySet<string>>(new Set())
  const [previewId, setPreviewId] = createSignal<string | null>(null)

  window.bench.registerTab(props.index, {
    load: setPhotos,
    append: list => setPhotos(prev => [...prev, ...list]),
  })
  function rate(id: string, rating: number) {
    setRatings(id, rating)
  }
  const ratingOf = (photo: Photo) => ratings[photo.id] ?? photo.rating

  const filtered = createMemo(() => filterPhotos(photos(), filter(), ratingOf))
  const previewIndex = createMemo(() => {
    const id = previewId()
    return id === null ? -1 : filtered().findIndex(p => p.id === id)
  })

  function toggle(id: string) {
    setSelection((prev) => {
      const next = new Set(prev)
      if (!next.delete(id))
        next.add(id)
      return next
    })
  }

  function onKeyDown(e: KeyboardEvent) {
    const index = previewIndex()
    const list = filtered()
    if (index !== -1) {
      const current = list[index]
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const to = list[index + (e.key === 'ArrowRight' ? 1 : -1)]
        if (to)
          setPreviewId(to.id)
      }
      else if (e.key === 'Escape') {
        setPreviewId(null)
      }
      else if (e.key === 'Backspace') {
        setPreviewId(idAfterDelete(list, index))
        const id = current.id
        setPhotos(prev => prev.filter(p => p.id !== id))
      }
      else if (e.key >= '1' && e.key <= '5') {
        rate(current.id, Number(e.key))
      }
      return
    }
    if (e.key === 'a' && e.metaKey) {
      e.preventDefault()
      setSelection(new Set(list.map(p => p.id)))
    }
    else if (e.key === 'Escape') {
      setSelection(new Set<string>())
    }
  }
  createEffect(() => {
    if (!props.active)
      return
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  return (
    <div class="gallery" data-tab={props.index} style={{ display: props.active ? undefined : 'none' }}>
      <div class="toolbar">
        <For each={FILTERS}>
          {f => (
            <button type="button" data-filter={f || 'all'} classList={{ active: f === filter() }} onClick={() => setFilter(f)}>
              {f ? `≥ ${f}★` : 'All'}
            </button>
          )}
        </For>
        <input
          class="width"
          type="range"
          min={MIN_COLUMN_WIDTH}
          max={MAX_COLUMN_WIDTH}
          value={columnWidth()}
          onInput={e => setColumnWidth(Number(e.currentTarget.value))}
        />
        <span class="count">
          {filtered().length}
          {' '}
          photos
        </span>
      </div>
      <Grid photos={filtered()} columnWidth={columnWidth()} selection={selection()} onOpen={setPreviewId} onRate={rate} onToggle={toggle} ratingOf={ratingOf} />
      <Show when={previewIndex() !== -1}>
        <Preview photos={filtered()} index={previewIndex()} onPick={setPreviewId} />
      </Show>
    </div>
  )
}
