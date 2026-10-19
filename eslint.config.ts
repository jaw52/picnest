import antfu from '@antfu/eslint-config'
import stylex from '@stylexjs/eslint-plugin'
import oxlint from 'eslint-plugin-oxlint'
import oxlintConfig, { vendoredFluid } from './oxlint.config'

// @stylexjs/eslint-plugin 0.19 的 valid-styles 仍调用 ESLint 10 已移除的
// context.getScope()，这里用 sourceCode 的作用域信息补上
const validStyles = stylex.rules['valid-styles']
const stylexPlugin = {
  rules: {
    ...stylex.rules,
    'valid-styles': {
      ...validStyles,
      create: (context: any) =>
        validStyles.create(
          Object.create(context, {
            getScope: {
              value: () => ({
                set: {
                  get: (name: string) =>
                    context.sourceCode.scopeManager.scopes
                      .find((scope: any) => scope.set.has(name))
                      ?.set
                      .get(name),
                },
              }),
            },
          }),
        ),
    },
  },
}

// oxlint 负责原生规则；ESLint 只跑 oxlint 无法覆盖的 JS 插件规则，
// 与 oxlint 重复的规则通过 eslint-plugin-oxlint 关闭（放在最后）
export default antfu(
  {
    react: true,
    antislop: true,
    // 类型感知规则只覆盖前端 tsconfig 包含的源码，根目录与 frontend 下的配置文件不在任何 tsconfig 里
    typescript: {
      tsconfigPath: 'apps/desktop/frontend/tsconfig.json',
      filesTypeAware: ['apps/desktop/frontend/src/**/*.{ts,tsx}'],
      overridesTypeAware: {
        // `path && …` 里空串与 null 同样表示“没有”，没必要逐个写成显式比较
        'ts/strict-boolean-expressions': ['error', { allowNullableBoolean: true, allowNullableObject: true, allowNullableString: true }],
      },
    },
    unicorn: { allRecommended: true },
    jsx: { a11y: true },
    // formatters 为 html/css 提供解析器，antislop 的通用规则因此能覆盖它们
    formatters: true,
    // apps/desktop/bin 是构建产物（含带更新说明的 update-*.json），antfu 只读根目录的 .gitignore
    ignores: ['**/frontend/src/mygo.ts', 'apps/desktop/bin/**', ...vendoredFluid],
  },
  {
    rules: {
      // 允许辅助组件、常量定义在使用处之后
      'ts/no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      // unicorn allRecommended 中与 React/Jotai 惯例冲突的规则：
      // props/ref/prev 等缩写、组件返回 null、PascalCase 组件文件名、isXxxAtom/setXxxAtom 这类 atom 命名
      'unicorn/name-replacements': 'off',
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      // 前端只跑在 WebView 里，window 比 globalThis 更直白
      'unicorn/prefer-global-this': 'off',
      // 单行 /* */ 注释是刻意的写法，不需要展开成多行
      'unicorn/single-line-block-comment-style': 'off',
      // React 19 的 ReactNode 包含 Promise，autofix 会把组件和 JSX 事件处理器改成 async
      'ts/promise-function-async': 'off',
      // t(cond ? 'a' : 'b') 会让 i18n key 失去字面量类型检查
      'unicorn/prefer-minimal-ternary': 'off',
      // useEffect 里无法 await，.then/.catch 链是惯用写法
      'unicorn/prefer-await': 'off',
      // 只是“建议核实后调整顺序”，不是缺陷
      'unicorn/prefer-simple-condition-first': 'off',
      // 模块级的计数器、定时器是刻意的单例状态
      'unicorn/no-top-level-assignment-in-function': 'off',
      // 前端 lib 停在 ES2023（最低支持 macOS 12 的 WebKit），这些 API 属于 ES2024/ES2025
      'unicorn/prefer-set-methods': 'off',
      'unicorn/prefer-iterator-to-array': 'off',
      'unicorn/prefer-promise-with-resolvers': 'off',
      // 与 e18e/prefer-array-fill 互相 autofix 打架，保留 e18e 的写法
      'unicorn/no-array-from-fill': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/src/test/**'],
    rules: {
      // 测试环境要给 jsdom 补全局 API，vi.mock 工厂会被提升、不能引用外层函数
      'unicorn/no-global-object-property-assignment': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'ts/unbound-method': 'off',
    },
  },
  {
    files: ['apps/desktop/frontend/src/**/*.{ts,tsx}'],
    plugins: { '@stylexjs': stylexPlugin },
    rules: {
      '@stylexjs/valid-styles': 'error',
      '@stylexjs/no-unused': 'error',
      '@stylexjs/no-conflicting-props': 'error',
      '@stylexjs/valid-shorthands': 'error',
      '@stylexjs/enforce-extension': 'error',
      '@stylexjs/no-legacy-contextual-styles': 'error',
      '@stylexjs/no-lookahead-selectors': 'error',
    },
  },
  ...oxlint.buildFromOxlintConfig(oxlintConfig),
)
