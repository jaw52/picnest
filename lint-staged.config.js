export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': ['oxlint --fix', 'eslint --fix'],
  // antfu 的 formatters 与 jsonc/yaml/toml/markdown 预设覆盖的其余文件
  '*.{html,css,md,json,jsonc,yaml,yml,toml}': 'eslint --fix --no-warn-ignored',
  // golangci-lint type-checks whole packages, so it checks the module, and
  // formats just the staged files.
  '*.go': files => [
    `go -C apps/desktop tool golangci-lint fmt ${files.join(' ')}`,
    'go -C apps/desktop tool golangci-lint run --fix',
  ],
}
