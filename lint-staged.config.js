export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': ['oxlint --fix', 'eslint --fix'],
  // golangci-lint type-checks whole packages, so it checks the module, and
  // formats just the staged files.
  '*.go': files => [
    `go -C apps/desktop tool golangci-lint fmt ${files.join(' ')}`,
    'go -C apps/desktop tool golangci-lint run --fix',
  ],
}
