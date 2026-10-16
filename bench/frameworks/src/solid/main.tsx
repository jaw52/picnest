import { render } from 'solid-js/web'
import { App } from './App.tsx'
import '../shared/harness.ts'
import '../shared/styles.css'

render(() => <App />, document.getElementById('app')!)
