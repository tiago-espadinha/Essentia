import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { getSupabase } from '@essentia/supabase'
import { applyStoredTheme } from '@essentia/ui'
import './dictum.css'
import App from './App'
import { readSharePath } from './share'
import { SharedView } from './SharedView'

applyStoredTheme()

// A share link (/dictum/shared/<id>) opens the reading view instead of the editor.
const shared = readSharePath(location.pathname)
if (shared) {
  // Shared documents are private to whoever holds the link: keep them out of search results.
  const robots = document.head.appendChild(document.createElement('meta'))
  robots.name = 'robots'
  robots.content = 'noindex'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{shared ? <SharedView linkId={shared.id} client={getSupabase()} /> : <App />}</StrictMode>,
)
