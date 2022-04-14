# @essentia/ui

Shared React pieces for every Essentia app: the theme (one `essentia-theme`
choice for the whole suite), the theme toggle and the back-to-hub link.

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
