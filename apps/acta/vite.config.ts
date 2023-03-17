import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { suitePwa } from '../../scripts/pwa.ts'

export default defineConfig({
  base: '/acta/',
  plugins: [react(), suitePwa('Acta', 'Acta · Your Tasks · Essentia')],
  server: { port: 5102, strictPort: true },
  test: {
    environment: 'jsdom',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ['--no-experimental-webstorage'],
  },
})
