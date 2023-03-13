# @essentia/ui

Shared React pieces for every Essentia app: the theme (one `essentia-theme`
choice for the whole suite), the theme toggle, the back-to-hub link and the
modal `Dialog` on the native `<dialog>`.

The hub also uses `AccentSelect` and `LocaleSelect`. Load the shared external
`accent-init.js` and `locale-init.js` head scripts through each app's public
symlinks before rendering. They apply stored preferences and listen for changes
from other tabs. `useLocale()` subscribes a view without remounting it;
`createTranslator()` uses an app-owned English-template-to-Portuguese catalog,
with named `{value}` interpolation and English fallback. Translate stored error
keys at render time so open feedback follows a language change. Use `formatDate`
and `formatNumber` for presentation, keeping parsers and persisted data separate.

```tsx
import '@essentia/tokens/index.css' // required: tokens and base styles
import { applyStoredTheme, HubLink, ThemeToggle } from '@essentia/ui'

applyStoredTheme() // before the first render
```

Each app's `index.html` adds the font preconnects:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```
