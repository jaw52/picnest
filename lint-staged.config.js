export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': 'eslint --fix',
  '*.{js,jsx,ts,tsx,mjs,cjs,css,html,json,jsonc,md,yaml,yml,toml}': 'oxfmt --no-error-on-unmatched-pattern',
  // golangci-lint type-checks whole packages, so it checks the module, and
  // formats just the staged files.
  '*.go': (files) => [
    `go -C apps/desktop tool golangci-lint fmt ${files.join(' ')}`,
    'go -C apps/desktop tool golangci-lint run --fix',
  ],
}
