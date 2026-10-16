import { MotionConfig } from 'framer-motion'
import { getDefaultStore } from 'jotai'
import * as React from 'react'
import ReactDOM from 'react-dom/client'
import { languageStateAtom } from '~/atoms/settings'
import { TooltipProvider } from '~/components/Tooltip'
import { SizeProvider } from '~/context/size'
import { initI18n } from '~/i18n'
import { setCollectionPath } from '~/lib/collection'
import { CollectPanel } from '~/modules/collect/CollectPanel'
import { App as GoApp } from '~/mygo'
import App from './App'
import './theme/theme.css'

// The menu bar icon's panel loads this page too, under #collect.
const isCollectPanel = window.location.hash === '#collect'
if (isCollectPanel) {
  // The panel's window is see-through, so its rounded corners show.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

// The first render is already in the app's language.
void Promise.all([GoApp.getLanguage(), GoApp.collectionPath()]).then(([languageState, collectionPath]) => {
  initI18n(languageState.language)
  getDefaultStore().set(languageStateAtom, languageState)
  setCollectionPath(collectionPath)

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      {/* Honour the OS reduced-motion setting in every framer-motion component. */}
      <MotionConfig reducedMotion="user">
        {/* A dense desktop tool: every control sits on the 28px compact step. */}
        <SizeProvider size="compact">
          <TooltipProvider>
            {isCollectPanel ? <CollectPanel /> : <App />}
          </TooltipProvider>
        </SizeProvider>
      </MotionConfig>
    </React.StrictMode>,
  )
})
