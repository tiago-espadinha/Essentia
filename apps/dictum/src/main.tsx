import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { applyStoredTheme, registerOfflineWorker } from '@essentia/ui'
import './dictum.css'
import { MovedPage } from './components/MovedPage'

// Share links open in Folio; this only catches one that reached Dictum's page
// anyway (vercel.json already sends them there, as does the dev proxy's Dictum).
if (location.pathname.startsWith(`${import.meta.env.BASE_URL}shared/`)) {
  location.replace(`/folio/shared/${location.pathname.slice(`${import.meta.env.BASE_URL}shared/`.length)}`)
} else {
  applyStoredTheme()
  // Kept so a Dictum installed on a device updates to this page.
  if (import.meta.env.PROD) registerOfflineWorker(import.meta.env.BASE_URL)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MovedPage />
    </StrictMode>,
  )
}
