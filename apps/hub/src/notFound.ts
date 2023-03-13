// Keep usable fallback HTML while applying device preferences without inline scripts.
import '@essentia/tokens/index.css'
import { applyStoredTheme, subscribeLocale } from '@essentia/ui'
import { t } from './locale'
import './not-found.css'

applyStoredTheme()

function renderNotFound() {
  document.title = t('Page not found · Essentia')
  const copy = {
    '.not-found__label': '404 · Not found',
    '.not-found__title': 'Nothing lives at this address.',
    '.not-found__text': 'The link may be mistyped or out of date. Every app starts from the home page.',
    '.not-found__action': 'Go to Essentia',
  }
  for (const [selector, text] of Object.entries(copy)) {
    const element = document.querySelector(selector)
    if (element) element.textContent = t(text)
  }
}

renderNotFound()
subscribeLocale(renderNotFound)
