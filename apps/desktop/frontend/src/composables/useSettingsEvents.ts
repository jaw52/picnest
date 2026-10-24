import { onScopeDispose } from 'vue'
import { setLanguage } from '~/i18n'
import { events } from '~/mygo'
import { languageState, settingsOpen } from '~/state/settings'

/**
 * Follows the language picked in Settings, whichever window picked it, and
 * opens Settings when the menu bar asks (Picnest ▸ Settings…, ⌘,).
 */
export function useSettingsEvents(): void {
  const offLanguage = events.languageChanged.on((state) => {
    setLanguage(state.language)
    languageState.value = state
  })
  const offSettings = events.openSettings.on(() => {
    settingsOpen.value = true
  })
  onScopeDispose(() => {
    offLanguage()
    offSettings()
  })
}
