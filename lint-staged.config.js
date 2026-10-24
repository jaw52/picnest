export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': 'eslint --fix',
  // antfu 的 formatters 与 jsonc/yaml/toml/markdown 预设覆盖的其余文件
  '*.{html,css,md,json,jsonc,yaml,yml,toml}': 'eslint --fix --no-warn-ignored',
  '*.{html,css,md,yaml,yml}': 'bun fmt --no-script',
  // golangci-lint type-checks whole packages, so it checks the module, and
  // formats just the staged files.
  '*.go': files => [
    `go -C apps/desktop tool golangci-lint fmt ${files.join(' ')}`,
    'go -C apps/desktop tool golangci-lint run --fix',
  ],
}
