import './styles/globals.css'

import { getDefaultStore } from 'jotai'
import { MotionConfig } from 'motion/react'
import * as React from 'react'
import ReactDOM from 'react-dom/client'

import { languageStateAtom } from '~/atoms/settings'
import { TooltipProvider } from '~/components/Tooltip'
import { initI18n } from '~/i18n'
import { CollectPanel } from '~/modules/collect/CollectPanel'
import { App as GoApp } from '~/mygo'

import App from './App'
import { useSystemTheme } from './lib/useSystemTheme'

function Root() {
  useSystemTheme()
  return <TooltipProvider>{isCollectPanel ? <CollectPanel /> : <App />}</TooltipProvider>
}

// The menu bar icon's panel loads this page too, under #collect.
const isCollectPanel = window.location.hash === '#collect'
if (isCollectPanel) {
  // The panel's window is see-through, so its rounded corners show.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

// The first render is already in the app's language.
void GoApp.getLanguage().then((languageState) => {
  initI18n(languageState.language)
  getDefaultStore().set(languageStateAtom, languageState)

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      {/* Honour the OS reduced-motion setting in every motion component. */}
      <MotionConfig reducedMotion="user">
        <Root />
      </MotionConfig>
    </React.StrictMode>,
  )
})
