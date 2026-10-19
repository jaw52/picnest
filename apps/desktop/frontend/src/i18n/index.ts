import type { Language } from '~/mygo'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'

export const resources = {
  'zh-CN': { translation: zhCN },
  'en': { translation: en },
} satisfies Record<Language, { translation: object }>

/** Starts i18next in `language`, ready before the first render. */
export function initI18n(language: Language) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    // React escapes what it renders.
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  document.documentElement.lang = language
}

/** Shows the app in `language`. */
export function changeLanguage(language: Language) {
  void i18n.changeLanguage(language)
  document.documentElement.lang = language
}

export { default as i18n } from 'i18next'
