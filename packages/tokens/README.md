# @essentia/tokens

Shared design tokens and base styles for every Essentia app. The approved
direction is in `docs/DESIGN_DIRECTION.md`.

```ts
import '@essentia/tokens/index.css'
```

That one import loads, in order:

- `fonts.css`: Instrument Sans, Instrument Serif and JetBrains Mono, defined once.
- `tokens.css`: colour, type, spacing, radius, elevation and motion, with light
  and dark themes (`data-theme` on `<html>`, system preference otherwise).
- `base.css`: reset, page background, the paper grain, the focus ring and the
  `.label` and `.visually-hidden` helpers.

Add `"@essentia/tokens": "workspace:*"` to the app's dependencies. Use the
`var(--color-*)` tokens instead of raw colours.
