import type { MessageSchema } from '.'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
