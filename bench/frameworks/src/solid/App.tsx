import { createSignal, For, onMount } from 'solid-js'
import { TAB_COUNT } from '../shared/harness.ts'
import { Gallery } from './Gallery.tsx'

const TABS = Array.from({ length: TAB_COUNT }, (_, i) => i)

export function App() {
  const [active, setActive] = createSignal(0)
  onMount(() => window.bench.mounted())

  return (
    <>
      <div class="tabbar">
        <For each={TABS}>
          {i => (
            <button type="button" data-tab={i} classList={{ active: i === active() }} onClick={() => setActive(i)}>
              Tab
              {' '}
              {i + 1}
            </button>
          )}
        </For>
      </div>
      {/* Hidden tabs keep their gallery, shown again as they were. */}
      <For each={TABS}>
        {i => <Gallery index={i} active={i === active()} />}
      </For>
    </>
  )
}
