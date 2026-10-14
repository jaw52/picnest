import type { zhCN } from './locales/zh-CN'
import 'i18next'

// Types `t` keys and their interpolations after the Chinese catalog, which
// every other catalog matches (see i18n.test.ts).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof zhCN }
  }
}
