import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import '../shared/harness.ts'
import '../shared/styles.css'

createRoot(document.getElementById('app')!).render(<App />)
