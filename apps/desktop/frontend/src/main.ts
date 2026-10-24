import { createApp } from 'vue'
import { i18n, setLanguage } from '~/i18n'
import { App as GoApp } from '~/mygo'
import { languageState } from '~/state/settings'
import Root from './Root.vue'
import '@fontsource-variable/inter/opsz.css'
import 'virtual:uno.css'
import './theme/tokens.css'
import './theme/theme.css'
import './theme/popup.css'

// The first render is already in the app's language.
void GoApp.getLanguage().then((state) => {
  setLanguage(state.language)
  languageState.value = state
  createApp(Root).use(i18n).mount('#app')
})
