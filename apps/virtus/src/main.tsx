import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { applyStoredTheme } from '@essentia/ui'
import './virtus.css'
import App from './App'

applyStoredTheme()

// Development serves modules unbundled, so only a build has a worker to register.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.error('Virtus could not be set up for offline use', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
