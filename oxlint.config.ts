import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'vue'],
  categories: {
    correctness: 'error',
  },
  rules: {},
  env: {
    builtin: true,
  },
  ignorePatterns: ['**/frontend/src/mygo.ts'],
})
