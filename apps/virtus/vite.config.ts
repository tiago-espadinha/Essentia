import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { MANIFEST_TOKEN, precacheFiles } from './src/offline.ts'

export default defineConfig({
  base: '/virtus/',
  plugins: [react(), offline()],
  server: { port: 5103, strictPort: true },
  test: {
    environment: 'jsdom',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ['--no-experimental-webstorage'],
    // Far from UTC, so a day keyed with toISOString lands on the wrong date; and
    // no Supabase project, whatever the local env file holds, so tests stay offline.
    env: { TZ: 'Pacific/Auckland', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})

/**
 * Builds sw/worker.ts to sw.js beside the page and writes the list of built and
 * public files into it. The version hashes their contents, so any change installs
 * a new cache.
 */
function offline(): Plugin {
  let publicDir = ''
  return {
    name: 'virtus-offline',
    apply: 'build',
    enforce: 'post',
    config: () => ({
      build: {
        rolldownOptions: {
          input: { index: 'index.html', sw: 'sw/worker.ts' },
          output: { entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js') },
        },
      },
    }),
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle(_, bundle) {
      const worker = bundle['sw.js']
      if (worker?.type !== 'chunk' || !worker.code.includes(MANIFEST_TOKEN)) this.error('sw.js was not built with its manifest placeholder')
      // A classic worker cannot import; this fails if app code starts sharing src/offline.ts.
      if (worker.imports.length > 0) this.error('sw.js must be a single file')

      const contents = new Map<string, string | Uint8Array>()
      for (const output of Object.values(bundle)) {
        contents.set(output.fileName, output.type === 'chunk' ? output.code : output.source)
      }
      for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue
        const path = join(entry.parentPath, entry.name)
        contents.set(relative(publicDir, path).split(sep).join('/'), readFileSync(path))
      }

      const files = precacheFiles([...contents.keys()])
      const hash = createHash('sha256')
      for (const file of files) hash.update(file).update(contents.get(file === './' ? 'index.html' : file) ?? '')
      // The worker's own code is left out: changing it alone still updates the worker, and the cached files are the same.
      const precache = { version: hash.digest('hex').slice(0, 12), files }
      worker.code = worker.code.replaceAll(MANIFEST_TOKEN, `(${JSON.stringify(precache)})`)
    },
  }
}
