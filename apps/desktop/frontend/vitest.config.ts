import path from 'node:path'

import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { stylexOptions } from './config/stylex.ts'

// The plugin's dev middleware polls on an interval that only stops when an HTTP
// server closes. Vitest has no HTTP server, so the interval would keep the
// process alive for 10s after the run; tests only need the compile step.
const stylexPlugins = [stylex.vite(stylexOptions)]
  .flat()
  .map(plugin => ({ ...plugin, configureServer: undefined }))

export default defineConfig({
  plugins: [...stylexPlugins, react()],
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
