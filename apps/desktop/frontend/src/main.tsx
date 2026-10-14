import { MotionConfig } from 'framer-motion'
import { getDefaultStore } from 'jotai'
import * as React from 'react'
import ReactDOM from 'react-dom/client'
import { languageStateAtom } from '~/atoms/settings'
import { TooltipProvider } from '~/components/Tooltip'
import { SizeProvider } from '~/context/size'
import { initI18n } from '~/i18n'
import { App as GoApp } from '~/mygo'
import App from './App'
import './theme/theme.css'

// The first render is already in the app's language.
void GoApp.getLanguage().then((languageState) => {
  initI18n(languageState.language)
  getDefaultStore().set(languageStateAtom, languageState)

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      {/* Honour the OS reduced-motion setting in every framer-motion component. */}
      <MotionConfig reducedMotion="user">
        {/* A dense desktop tool: every control sits on the 28px compact step. */}
        <SizeProvider size="compact">
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </SizeProvider>
      </MotionConfig>
    </React.StrictMode>,
  )
})
