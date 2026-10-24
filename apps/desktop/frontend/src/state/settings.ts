import type { LanguageState } from '~/mygo'
import { shallowRef } from 'vue'

/** The language picked in Settings, and the one the app is shown in. */
export const languageState = shallowRef<LanguageState>({ preference: 'system', language: 'en' })

/** Whether the Settings dialog is open. */
export const settingsOpen = shallowRef(false)
