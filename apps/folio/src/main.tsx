import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { applyStoredTheme } from '@essentia/ui'
import './folio.css'
import App from './App'

applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
