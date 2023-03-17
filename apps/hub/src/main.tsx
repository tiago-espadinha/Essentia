import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { applyStoredTheme, registerOfflineWorker } from '@essentia/ui'
import './hub.css'
import App from './App'

applyStoredTheme()

if (import.meta.env.PROD) registerOfflineWorker(import.meta.env.BASE_URL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
