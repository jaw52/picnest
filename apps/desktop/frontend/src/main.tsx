import { MotionConfig } from 'framer-motion'
import * as React from 'react'
import ReactDOM from 'react-dom/client'
import { TooltipProvider } from '~/components/Tooltip'
import { SizeProvider } from '~/context/size'
import App from './App'
import './theme/theme.css'

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
