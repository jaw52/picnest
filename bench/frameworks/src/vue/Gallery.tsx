import type { Photo } from '../shared/types.ts'
import { computed, defineComponent, reactive, ref, shallowRef, watchEffect } from 'vue'
import { DEFAULT_COLUMN_WIDTH, filterPhotos, FILTERS, idAfterDelete, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from '../shared/gallery.ts'
import { Grid } from './Grid.tsx'
import { Preview } from './Preview.tsx'

export const Gallery = defineComponent((props: { index: number, active: boolean }) => {
  // The list in a shallow ref of plain photos (no proxies over thousands
  // of them); changed ratings in a reactive object by id, so rating a
  // photo re-renders its tile and nothing else.
  const photos = shallowRef<Photo[]>([])
  const ratings = reactive<Record<string, number>>({})
  const filter = ref(0)
  const columnWidth = ref(DEFAULT_COLUMN_WIDTH)
  const selection = shallowRef<ReadonlySet<string>>(new Set())
  const previewId = ref<string | null>(null)

  window.bench.registerTab(props.index, {
    load: (list) => {
      photos.value = list
    },
    append: (list) => {
      photos.value = [...photos.value, ...list]
    },
  })
  function rate(id: string, rating: number) {
    ratings[id] = rating
  }
  const ratingOf = (photo: Photo) => ratings[photo.id] ?? photo.rating

  const filtered = computed(() => filterPhotos(photos.value, filter.value, ratingOf))
  const previewIndex = computed(() => previewId.value === null ? -1 : filtered.value.findIndex(p => p.id === previewId.value))

  function toggle(id: string) {
    const next = new Set(selection.value)
    if (!next.delete(id))
      next.add(id)
    selection.value = next
  }
  function open(id: string) {
    previewId.value = id
  }

  function onKeyDown(e: KeyboardEvent) {
    const index = previewIndex.value
    const list = filtered.value
    if (index !== -1) {
      const current = list[index]
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const to = list[index + (e.key === 'ArrowRight' ? 1 : -1)]
        if (to)
          previewId.value = to.id
      }
      else if (e.key === 'Escape') {
        previewId.value = null
      }
      else if (e.key === 'Backspace') {
        previewId.value = idAfterDelete(list, index)
        photos.value = photos.value.filter(p => p.id !== current.id)
      }
      else if (e.key >= '1' && e.key <= '5') {
        rate(current.id, Number(e.key))
      }
      return
    }
    if (e.key === 'a' && e.metaKey) {
      e.preventDefault()
      selection.value = new Set(list.map(p => p.id))
    }
    else if (e.key === 'Escape') {
      selection.value = new Set()
    }
  }
  watchEffect((onCleanup) => {
    if (!props.active)
      return
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  return () => (
    <div class="gallery" data-tab={props.index} v-show={props.active}>
      <div class="toolbar">
        {FILTERS.map(f => (
          <button key={f} type="button" data-filter={f || 'all'} class={{ active: f === filter.value }} onClick={() => (filter.value = f)}>
            {f ? `≥ ${f}★` : 'All'}
          </button>
        ))}
        <input
          class="width"
          type="range"
          min={MIN_COLUMN_WIDTH}
          max={MAX_COLUMN_WIDTH}
          value={columnWidth.value}
          onInput={e => (columnWidth.value = Number((e.target as HTMLInputElement).value))}
        />
        <span class="count">
          {filtered.value.length}
          {' '}
          photos
        </span>
      </div>
      <Grid photos={filtered.value} columnWidth={columnWidth.value} selection={selection.value} onOpen={open} onRate={rate} onToggle={toggle} ratingOf={ratingOf} />
      {previewIndex.value !== -1 && <Preview photos={filtered.value} index={previewIndex.value} onPick={open} />}
    </div>
  )
}, { props: ['index', 'active'] })
