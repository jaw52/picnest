import type { LanguageState } from '~/mygo'
import { atom } from 'jotai'

/** The language picked in Settings, and the one the app is shown in. */
export const languageStateAtom = atom<LanguageState>({ preference: 'system', language: 'en' })

/** Whether the Settings dialog is open. */
export const settingsOpenAtom = atom(false)
