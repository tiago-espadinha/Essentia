// Combines every app build into one deployable folder:
// dist/ holds the hub, and dist/<app>/ holds each app under its own path.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'

const out = 'dist'
const apps = existsSync('apps')
  ? readdirSync('apps', { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(`apps/${entry.name}/dist`))
      .map((entry) => entry.name)
  : []

rmSync(out, { recursive: true, force: true })
mkdirSync(out)

for (const app of apps) {
  cpSync(`apps/${app}/dist`, app === 'hub' ? out : `${out}/${app}`, { recursive: true })
}

// Merces keeps the former finance entry available for saved links. Both copies
// use the canonical /merces/ asset base and the same origin-scoped storage.
if (apps.includes('aurum')) {
  cpSync(`${out}/aurum`, `${out}/merces`, { recursive: true })
}

console.log(`Assembled ${apps.length} build(s) into ${out}/: ${apps.join(', ') || 'none'}`)
