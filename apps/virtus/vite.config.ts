import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/virtus/',
  plugins: [react()],
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
