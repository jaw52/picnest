/// <reference types="vite/client" />

// For tools that type-check .ts files without Vue's language service (the
// linter); vue-tsc reads the components themselves.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
