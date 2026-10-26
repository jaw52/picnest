import { defineConfig } from '@lobehub/eslint-config'
import slop from 'eslint-plugin-slop'
import sonarjs from 'eslint-plugin-sonarjs'
import tseslint from 'typescript-eslint'

// Fluid Functionalism hooks and motion tokens, still kept as installed
// upstream; they do not take part in lint.
const fluid = 'apps/desktop/frontend/src'
const vendoredFluid = [`${fluid}/hooks/use-fluid-hover.ts`, `${fluid}/lib/springs.ts`]

export default defineConfig(
  {
    react: 'vite',
    reactCompiler: true,
    a11y: true,
    typescript: true,
    // 类型感知规则只覆盖前端 tsconfig 包含的源码，根目录与 frontend 下的配置文件不在任何 tsconfig 里
    typeChecked: true,
    tsconfigPath: 'apps/desktop/frontend/tsconfig.json',
    // apps/desktop/bin 是构建产物（含带更新说明的 update-*.json）
    ignores: ['**/frontend/src/mygo.ts', 'apps/desktop/bin/**', ...vendoredFluid],
  },
  // antislop：lobehub 没有内置该选项，手动接入 slop 与 sonarjs，规则取自 @antfu/eslint-config 的 antislop 规则集
  {
    plugins: { slop, sonarjs },
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    rules: {
      'slop/no-em-dash': 'error',
      'slop/max-comment-length': 'error',
      'slop/no-chained-type-assertions': 'error',
      'slop/no-jargon': 'error',
      'slop/no-trivial-functions': 'error',
      'slop/no-trivial-type-aliases': 'error',
      'slop/prefer-jsdoc': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-commented-code': 'error',
      'sonarjs/no-dead-store': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-invariant-returns': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',
    },
  },
  {
    rules: {
      // 允许辅助组件、常量定义在使用处之后
      '@typescript-eslint/no-use-before-define': ['error', { classes: false, functions: false, variables: false }],
      // unicorn 中与 React/Jotai 惯例冲突的规则：
      // props/ref/prev 等缩写、组件返回 null、PascalCase 组件文件名
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/prevent-abbreviations': 'off',
      // 前端只跑在 WebView 里，window 比 globalThis 更直白
      'unicorn/prefer-global-this': 'off',
      // React 19 的 ReactNode 包含 Promise，autofix 会把组件和 JSX 事件处理器改成 async
      '@typescript-eslint/promise-function-async': 'off',
      // useEffect 里无法 await，.then/.catch 链是惯用写法
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  // 类型感知规则只跑前端 src，其余文件（yml、md、根目录配置）没有 tsconfig 可用
  {
    files: ['**/*'],
    ignores: ['apps/desktop/frontend/src/**/*.{ts,tsx}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/src/test/**'],
    rules: {
      // 测试环境要给 jsdom 补全局 API，vi.mock 工厂会被提升、不能引用外层函数
      'unicorn/consistent-function-scoping': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // 测试里的 mockImplementation(async () => …) 只是为了返回 Promise
      '@typescript-eslint/require-await': 'off',
    },
  },
)
