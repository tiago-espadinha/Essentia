import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/acta/',
  plugins: [react()],
  server: { port: 5102, strictPort: true },
  test: {
    environment: 'jsdom',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ['--no-experimental-webstorage'],
  },
})
