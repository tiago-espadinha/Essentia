// Config for `pnpm preview`, which serves the assembled dist/ as Vercel does.
// Mirrors the rewrite in vercel.json: a /dictum/ path that is not a file gets
// Dictum's index.html, so share links open Dictum instead of the hub.
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

const outDir = 'dist'

function isFile(pathname) {
  return statSync(join(outDir, pathname), { throwIfNoEntry: false })?.isFile() ?? false
}

const dictumRewrite = {
  name: 'dictum-rewrite',
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [pathname] = req.url.split('?')
      let decoded
      try {
        decoded = decodeURIComponent(pathname)
      } catch {
        return next()
      }
      if (decoded.startsWith('/dictum/') && !isFile(decoded)) {
        req.url = '/dictum/index.html'
      }
      next()
    })
  },
}

export default defineConfig({
  build: { outDir },
  preview: { port: 4173 },
  plugins: [dictumRewrite],
})
