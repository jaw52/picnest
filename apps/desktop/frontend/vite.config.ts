import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  clearScreen: false,
  plugins: [vue(), unocss()],
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    // Matches devUrl in ../mygo.json.
    port: 9245,
    strictPort: true,
  },
})
