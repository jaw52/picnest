import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: { a11y: true },
    unocss: true,
    pnpm: true,
    antislop: true,
    // 类型感知规则只覆盖前端 tsconfig 包含的源码
    typescript: {
      tsconfigPath: 'apps/desktop/frontend/tsconfig.json',
      filesTypeAware: ['apps/desktop/frontend/src/**/*.ts'],
      overridesTypeAware: {
        // `path && …` 里空串与 null 同样表示“没有”，没必要逐个写成显式比较
        'ts/strict-boolean-expressions': ['error', { allowNullableBoolean: true, allowNullableObject: true, allowNullableString: true }],
      },
    },
    unicorn: { allRecommended: true },
    // formatters 为 html/css 提供解析器，antislop 的通用规则因此能覆盖它们
    formatters: true,
    // apps/desktop/bin 是构建产物（含带更新说明的 update-*.json），antfu 只读根目录的 .gitignore
    ignores: ['**/frontend/src/mygo.ts', 'apps/desktop/bin/**'],
  },
  {
    rules: {
      // 允许辅助函数、常量定义在使用处之后
      'ts/no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      // unicorn allRecommended 中与本项目惯例冲突的规则：
      // props/ref/prev 等缩写、表示“没有”的 null、PascalCase 组件文件名、isXxx 以外的布尔命名
      'unicorn/name-replacements': 'off',
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      // 前端只跑在 WebView 里，window 比 globalThis 更直白
      'unicorn/prefer-global-this': 'off',
      // 单行 /* */ 注释是刻意的写法，不需要展开成多行
      'unicorn/single-line-block-comment-style': 'off',
      // t(cond ? 'a' : 'b') 会让 i18n key 失去字面量类型检查
      'unicorn/prefer-minimal-ternary': 'off',
      // watch 回调里不 await，.then/.catch 链是惯用写法
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
    files: ['**/*.test.ts', '**/src/test/**'],
    rules: {
      // 测试环境要给 happy-dom 补全局 API，vi.mock 工厂会被提升、不能引用外层函数
      'unicorn/no-global-object-property-assignment': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'ts/unbound-method': 'off',
    },
  },
)
