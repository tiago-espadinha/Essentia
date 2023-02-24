// The 404 page is static HTML; this module only brings in the suite's styles
// and the stored theme, since the CSP allows no inline styles or scripts.
import '@essentia/tokens/index.css'
import { applyStoredTheme } from '@essentia/ui'
import './not-found.css'

applyStoredTheme()
