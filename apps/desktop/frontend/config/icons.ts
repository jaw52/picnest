import type { Options } from 'unplugin-icons/types'

/** unplugin-icons options, shared by the Vite and Vitest configs. */
export const iconsOptions: Options = {
  compiler: 'jsx',
  jsx: 'react',
  // 24px unless a use site passes width/height, and hidden from assistive
  // tech: every icon sits next to text or inside a labelled control.
  iconCustomizer: (_collection, _icon, props) => {
    props.width = '24'
    props.height = '24'
    props['aria-hidden'] = 'true'
  },
}
