import type { PluginOption } from 'vite'
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

interface Variant {
  dir: string
  plugins: () => PluginOption[]
}

/**
 * Which app to build, from the FW environment variable: each framework
 * written the way that runs fastest in it (see README).
 */
const variants: Record<string, Variant> = {
  react: { dir: 'react', plugins: () => [react(), babel({ presets: [reactCompilerPreset()] })] },
  solid: { dir: 'solid', plugins: () => [solid()] },
  vue: { dir: 'vue', plugins: () => [vueJsx()] },
}

const fw = process.env.FW ?? 'react'
const variant = variants[fw]
if (!variant)
  throw new Error(`Unknown FW "${fw}"; one of ${Object.keys(variants).join(', ')}`)

export default defineConfig({
  root: fileURLToPath(new URL(`./src/${variant.dir}`, import.meta.url)),
  base: `/${fw}/`,
  plugins: variant.plugins(),
  build: {
    outDir: fileURLToPath(new URL(`./dist/${fw}`, import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
  },
})
