import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { suiteApps } from './src/apps.ts'

// In dev the hub fronts every app on one origin, mirroring production,
// so the shared theme and links between apps behave the same in both.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5100,
    strictPort: true,
    proxy: Object.fromEntries(
      suiteApps.map((app) => [app.path, { target: `http://localhost:${app.port}`, ws: true }]),
    ),
  },
  // 404.html lands at the root of dist/, where Vercel serves it for unknown paths.
  build: {
    rolldownOptions: {
      input: { main: 'index.html', notFound: '404.html' },
    },
  },
})
