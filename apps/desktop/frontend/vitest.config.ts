import path from 'node:path'

import react from '@vitejs/plugin-react'
import icons from 'unplugin-icons/vite'
import { defineConfig } from 'vitest/config'

import { iconsOptions } from './config/icons.ts'

export default defineConfig({
  plugins: [react({ compiler: true }), icons(iconsOptions)],
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
