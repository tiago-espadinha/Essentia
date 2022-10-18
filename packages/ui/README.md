# @essentia/ui

Shared React pieces for every Essentia app: the theme (one `essentia-theme`
choice for the whole suite), the theme toggle, the back-to-hub link and the
modal `Dialog` on the native `<dialog>`.

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
