import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

/** StyleX build options, shared by the Vite and Vitest configs. */
export const stylexOptions = {
  // `~/*` is the app's import alias (see tsconfig paths); StyleX has to resolve
  // it too, to follow imports of `*.stylex.ts` token files.
  aliases: { '~/*': [path.join(root, 'src/*')] },
  unstable_moduleResolution: { type: 'commonJS' as const, rootDir: root },
}
