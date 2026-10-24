import type { Language } from '~/mygo'
import { createI18n } from 'vue-i18n'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'

/** Types `t` keys after the Chinese catalog, which every other catalog matches (see i18n.test.ts). */
export type MessageSchema = typeof zhCN

export const messages = {
  'zh-CN': zhCN,
  'en': en,
} satisfies Record<Language, MessageSchema>

export const i18n = createI18n<[MessageSchema], Language, false>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
})

/** Shows the app in `language`; set before the first render, so it starts in it. */
export function setLanguage(language: Language): void {
  i18n.global.locale.value = language
  document.documentElement.lang = language
}

/** The app's `t`, for code outside components. */
export const t = i18n.global.t
