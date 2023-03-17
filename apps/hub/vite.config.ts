import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { suitePwa } from '../../scripts/pwa.ts'
import { suiteApps } from './src/domain/apps.ts'

// In dev the hub fronts every app on one origin, mirroring production,
// so the shared theme and links between apps behave the same in both.
export default defineConfig({
  plugins: [react(), suitePwa('Essentia', 'Essentia')],
  server: {
    port: 5100,
    strictPort: true,
    proxy: Object.fromEntries(
      suiteApps.flatMap((app) => [app.path, ...(app.aliases ?? [])].map((path) => [path, {
        target: `http://localhost:${app.port}`,
        ws: true,
        rewrite: (url: string) => app.path + url.slice(path.length),
      }])),
    ),
  },
  // 404.html lands at the root of dist/, where Vercel serves it for unknown paths.
  build: {
    rolldownOptions: {
      input: { main: 'index.html', notFound: '404.html' },
    },
  },
})
