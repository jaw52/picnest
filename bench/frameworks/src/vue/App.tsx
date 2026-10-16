import { defineComponent, onMounted, ref } from 'vue'
import { TAB_COUNT } from '../shared/harness.ts'
import { Gallery } from './Gallery.tsx'

const TABS = Array.from({ length: TAB_COUNT }, (_, i) => i)

export const App = defineComponent(() => {
  const active = ref(0)
  onMounted(() => window.bench.mounted())

  return () => (
    <>
      <div class="tabbar">
        {TABS.map(i => (
          <button key={i} type="button" data-tab={i} class={{ active: i === active.value }} onClick={() => (active.value = i)}>
            Tab
            {' '}
            {i + 1}
          </button>
        ))}
      </div>
      {/* Hidden tabs keep their gallery (v-show), shown again as they were. */}
      {TABS.map(i => <Gallery key={i} index={i} active={i === active.value} />)}
    </>
  )
})
