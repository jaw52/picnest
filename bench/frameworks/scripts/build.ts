// Builds every app (or those named on the command line) for production.

import { execFileSync } from 'node:child_process'
import { FRAMEWORKS } from './frameworks.ts'

const wanted = process.argv.slice(2)
for (const fw of wanted.length ? wanted : FRAMEWORKS) {
  console.log(`\n▶ build ${fw}`)
  execFileSync('bunx', ['vite', 'build', '--logLevel', 'warn'], { stdio: 'inherit', env: { ...process.env, FW: fw } })
}
