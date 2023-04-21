// Config for `pnpm preview`, which serves the assembled dist/ as Vercel does.
// Mirrors the rewrites in vercel.json: a share link, at /folio/shared/<id> or
// Dictum's older /dictum/shared/<id>, gets Folio's index.html; any other /dictum/
// path that is not a file gets Dictum's.
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

const outDir = 'dist'

function isFile(pathname) {
  return statSync(join(outDir, pathname), { throwIfNoEntry: false })?.isFile() ?? false
}

/** The file served for a decoded path, or the path itself when no rewrite applies. */
export function rewrite(pathname, fileExists = isFile) {
  if (/^\/(folio|dictum)\/shared\/[^/]+\/?$/.test(pathname)) return '/folio/index.html'
  if (pathname.startsWith('/dictum/') && !fileExists(pathname)) return '/dictum/index.html'
  return pathname
}

const rewrites = {
  name: 'vercel-rewrites',
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [pathname] = req.url.split('?')
      let decoded
      try {
        decoded = decodeURIComponent(pathname)
      } catch {
        return next()
      }
      const target = rewrite(decoded)
      if (target !== decoded) req.url = target
      next()
    })
  },
}

export default defineConfig({
  build: { outDir },
  preview: { port: 4173 },
  plugins: [rewrites],
})
