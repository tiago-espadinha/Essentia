import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { suitePwa } from '../../scripts/pwa.ts'

export default defineConfig({
  base: '/folio/',
  plugins: [react(), suitePwa('Folio', 'Folio · Your Notes · Essentia')],
  server: { port: 5101, strictPort: true },
  test: {
    environment: 'jsdom',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ['--no-experimental-webstorage'],
  },
})
