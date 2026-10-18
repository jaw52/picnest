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
    // antislop 的通用规则会匹配所有文件，ESLint 无法解析 html/css
    // apps/desktop/bin 是构建产物（含带更新说明的 update-*.json），antfu 只读根目录的 .gitignore
    ignores: ['**/frontend/src/mygo.ts', '**/*.html', '**/*.css', 'apps/desktop/bin/**', ...vendoredFluid],
  },
  {
    rules: {
      // 允许辅助组件、常量定义在使用处之后
      'ts/no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
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
