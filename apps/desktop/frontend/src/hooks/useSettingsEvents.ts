import { useSetAtom } from 'jotai'
import { useEffect } from 'react'

import { languageStateAtom, settingsOpenAtom } from '~/atoms/settings'
import { changeLanguage } from '~/i18n'
import { events } from '~/mygo'

/**
 * Follows the language picked in Settings, whichever window picked it, and
 * opens Settings when the menu bar asks (Picnest ▸ Settings…, ⌘,).
 */
export function useSettingsEvents() {
  const setLanguageState = useSetAtom(languageStateAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  useEffect(() => {
    const offLanguage = events.languageChanged.on((state) => {
      changeLanguage(state.language)
      setLanguageState(state)
    })
    const offSettings = events.openSettings.on(() => setSettingsOpen(true))
    return () => {
      offLanguage()
      offSettings()
    }
  }, [setLanguageState, setSettingsOpen])
}
