import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { suitePwa } from '../../scripts/pwa.ts'

export default defineConfig({
  base: '/dictum/',
  plugins: [react(), suitePwa('Dictum', 'Dictum · Your Writing · Essentia')],
  server: { port: 5104, strictPort: true },
  test: {
    environment: 'jsdom',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ['--no-experimental-webstorage'],
    // No Supabase project, whatever the local env file holds, so tests stay offline.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
