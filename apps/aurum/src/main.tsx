import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@essentia/tokens/index.css'
import { getSupabase } from '@essentia/supabase'
import { applyStoredTheme } from '@essentia/ui'
import './aurum.css'
import App from './App'

applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App client={getSupabase()} />
  </StrictMode>,
)
