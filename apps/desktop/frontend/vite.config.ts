import path from 'node:path'

import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { stylexOptions } from './config/stylex.ts'

export default defineConfig({
  clearScreen: false,
  plugins: [stylex.vite(stylexOptions), react()],
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
