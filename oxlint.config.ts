import { defineConfig } from 'oxlint'

// Fluid Functionalism hooks and motion tokens, still kept as installed
// upstream; they do not take part in lint.
const fluid = 'apps/desktop/frontend/src'
export const vendoredFluid = [`${fluid}/hooks/use-fluid-hover.ts`, `${fluid}/lib/springs.ts`]

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'react'],
  categories: {
    correctness: 'error',
  },
  rules: {},
  env: {
    builtin: true,
  },
  ignorePatterns: ['**/frontend/src/mygo.ts', ...vendoredFluid],
})
