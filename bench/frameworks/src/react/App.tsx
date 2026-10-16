import type { SetStateAction } from 'react'
import type { Photo } from '../shared/types.ts'
import { Activity, useEffect, useMemo, useState } from 'react'
import { TAB_COUNT } from '../shared/harness.ts'
import { Gallery } from './Gallery.tsx'
import { Ratings } from './ratings.ts'

const TABS = Array.from({ length: TAB_COUNT }, (_, i) => i)

export function App() {
  const [active, setActive] = useState(0)
  // Held here rather than in each Gallery: a hidden <Activity> runs no
  // effects, and the photos must load into hidden tabs too (the app keeps
  // them in atoms for the same reason).
  const [photos, setPhotos] = useState<Photo[][]>(() => TABS.map(() => []))
  const [ratings] = useState(() => TABS.map(() => new Ratings()))
  const setters = useMemo(() => TABS.map(i => (action: SetStateAction<Photo[]>) => {
    setPhotos(tabs => tabs.with(i, typeof action === 'function' ? action(tabs[i]) : action))
  }), [])
  useEffect(() => {
    TABS.forEach(i => window.bench.registerTab(i, {
      load: setters[i],
      append: batch => setters[i](prev => [...prev, ...batch]),
    }))
    window.bench.mounted()
  }, [setters, ratings])

  return (
    <>
      <div className="tabbar">
        {TABS.map(i => (
          <button key={i} type="button" data-tab={i} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
            Tab
            {' '}
            {i + 1}
          </button>
        ))}
      </div>
      {/* Hidden tabs keep their gallery, as the app's TabPane does. */}
      {TABS.map(i => (
        <Activity key={i} mode={i === active ? 'visible' : 'hidden'}>
          <Gallery index={i} active={i === active} photos={photos[i]} setPhotos={setters[i]} ratings={ratings[i]} />
        </Activity>
      ))}
    </>
  )
}
