import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { getSupabase } from '@essentia/supabase'
import { applyStoredTheme, registerOfflineWorker } from '@essentia/ui'
import './folio.css'
import App from './App'
import { readSharePath } from './domain/share'
import { SharedView } from './components/SharedView'

applyStoredTheme()

// A share link opens the reading view instead of the notes, which it never loads.
const shared = readSharePath(location.pathname)

if (shared) {
  // Shared notes are private to whoever holds the link: keep them out of search results.
  const robots = document.head.appendChild(document.createElement('meta'))
  robots.name = 'robots'
  robots.content = 'noindex'
} else if (import.meta.env.PROD) {
  registerOfflineWorker(import.meta.env.BASE_URL)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{shared ? <SharedView linkId={shared.id} client={getSupabase()} /> : <App />}</StrictMode>,
)
