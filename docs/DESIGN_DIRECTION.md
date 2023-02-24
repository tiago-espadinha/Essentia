# UX/UI Design Direction

Status: Approved
Tokens file: packages/tokens/tokens.css
Approved by: tiago-espadinha

## Design thesis
Warm paper, quiet ink: five tools that feel like good stationery. The interface steps back so the content (tasks, notes, habits, writing, money) is what you see.

## Fit
The suite is for daily personal use, so it has to be calm enough to open many times a day, and it is shown to portfolio reviewers, so it has to look deliberate rather than templated. One editorial language across five apps makes the suite read as one product, while each app keeps the layout its content needs.

## Choice and alternatives
- Chosen: codify the existing look (mode `codify`). All six UIs already share this thesis; the work is normalization.
- Alternatives considered: a redesign (`create` mode); per-app accent colours.
- Why this one won: the existing UI is strong and consistent in intent; one terracotta accent gives the strongest suite identity.
- Trade-offs: apps are told apart by name, serif title and icon, not colour.

## References
`design/refs/` is empty. The references are the existing apps and the original mockups in `docs/specs/` (`todo-design-6.html`, `design-1-editorial.html`, `habit_tracker_ui.html`, `markdown_editor_ui.html`, `personal_finance_ui.html`): borrow the serif display titles, mono metadata labels, hairline rules and generous whitespace.

## Principles
1. Content first: chrome is quiet, flat, and uses hairlines rather than boxes and shadows.
2. One suite: same tokens, theme, type and controls in every app; layouts differ only where the content needs it.
3. Readable by everyone: WCAG 2.2 AA contrast, 11 px minimum text, full keyboard use.

## Visual language
- Tone: calm, editorial, warm, unhurried.
- Typography:
  - Instrument Serif: display and headings (app titles, section titles, large numbers).
  - Instrument Sans: UI and body text (`--text-sm` 14 px for UI, `--text-md` 16 px for reading).
  - JetBrains Mono: metadata labels (dates, counts, categories), uppercase with `--tracking-label`, `--text-2xs` 11 px.
  - Lora: Folio's editor body only.
  - Scale: 11 / 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 px. Nothing below 11 px.
  - Playfair Display is retired.
- Color roles (light / dark):
  - Background `--color-sand` #F2EDE6 / #1A1816; surface `--color-paper` #EDE8E0 / #222019.
  - Text `--color-ink` #2A2520 / #E8E3DC; muted `--color-mid` #6F665D / #9A9087.
  - Decorative lines `--color-faint` #DDD8D0 / #2F2C28; control borders `--color-line-strong` #8A8076 / #7A7168.
  - Primary action and accent fill `--color-terracotta` #B8572A / #D4764A, with `--color-on-accent` #FFFFFF / #1A1816.
  - Accent text and links `--color-accent-text` #A24B23 / #D4764A.
  - Status: success #3F6B4C / #6AAF7D; danger #B23F3F / #E06060.
  - All text pairs are 4.5:1 or better; control borders 3:1 or better (ratios in the tokens file).
- Spacing scale: 4 px base: 2, 4, 8, 12, 16, 24, 32, 48, 64, 96 (`--space-*`).
- Borders, radius, elevation: 1 px hairlines in `--color-faint`; radius 6 / 10 / 14 / full; flat by default, `--shadow-overlay` only for popovers, menus and dialogs.
- Iconography: simple line icons, 1.5 px stroke, `currentColor`, 16 and 20 px; always paired with a text label or an `aria-label`.
- Motion: `--duration-fast` 150 ms for hover and press, `--duration-normal` 250 ms for panels and dialogs; no decorative animation; zero under `prefers-reduced-motion`.
- Imagery: none; data visualizations (heatmap, charts) use the accent, ink and mid tokens.
- Content voice: short, plain, lowercase-friendly labels; no exclamation marks; errors say what happened and what to do.

## Signature element
A faint paper grain over every app (`body::before`, SVG noise at `--grain-opacity` 0.04, `pointer-events: none`), off in dark mode. It makes the suite feel like paper without costing legibility.

## Rules
- **Do:** use serif titles and mono labels to create hierarchy; separate with hairlines and whitespace; keep one primary (terracotta) action per view; use `--color-accent-text` for accent-coloured text; share the theme toggle and back-to-hub link.
- **Avoid:** per-app colour schemes or new hex values in app CSS; drop shadows on cards; text below 11 px; muted text in `--color-faint`; `--color-faint` as an input border; Playfair Display; component-library default looks.

## Components and patterns
| Component | Purpose | Rules and states |
|---|---|---|
| App header | Serif app title, back-to-hub link, theme toggle (`@essentia/ui`: toggle button, moon icon, pressed = dark) | Same in every app; sticky in column apps |
| Primary button | The one main action | Terracotta fill, `--color-on-accent` text, radius-sm; hover, active, focus ring, disabled, loading |
| Secondary / ghost button | Other actions | Transparent, ink text, `--color-line-strong` border on focus/hover |
| Text input, select, textarea | Data entry | `--color-line-strong` border, radius-sm, label above, inline validation in danger colour |
| Mono label | Metadata, categories, dates | `--font-mono`, 11 px, uppercase, `--color-mid` |
| List row | Tasks, transactions, habits, notes | Hairline separators, no cards; hover tint `--color-paper`; selected state with accent bar |
| Dialog / popover | Confirm, share, forms | `--color-paper`, radius-lg, `--shadow-overlay`, focus trapped, Esc closes |
| Empty state | First use | Serif one-liner, one sentence in muted text, primary action (exceptions, user decisions 2026-10-16: the hub before any app exists has no action; when the view's own add field sits directly above the empty state, that field is the action and no button repeats it, as in Acta) |
| Toast / inline error | Feedback | Plain text, status colour, retry action where it applies |

## Responsive behavior
- 375px: column apps full width with 16 px gutters; Folio and Dictum collapse to one pane at a time with a back control; touch targets at least 44 px.
- 768px: column apps centred at `--width-column`; Folio shows list + editor; Dictum shows editor with toggleable preview.
- 1280px: Folio three panes; Dictum editor + preview side by side; the hub centred at `--width-hub`.
- Navigation changes: the back-to-hub link stays in the header at every width; pane navigation replaces side panes below 768 px.

## Accessibility
- Keyboard and focus: every action reachable by keyboard; visible 2 px focus ring in `--color-focus` with 2 px offset; dialogs trap focus and restore it.
- Semantics and labels: landmarks (`header`, `main`, `nav`); real buttons and inputs; labels on every control; charts and the heatmap have text alternatives.
- Contrast: WCAG 2.2 AA; ratios recorded in the tokens file.
- Reduced motion: durations drop to 0 under `prefers-reduced-motion`.

## UI states
Loading / Empty / Error and retry / Success / Disabled / Validation / Permission denied: every data view has loading (quiet skeleton lines, no spinners over 300 ms waits), empty (see component), error with retry, and success feedback; disabled controls keep 3:1 borders; validation is inline under the field; signed-out states in Aurum and synced views explain sign-in with one action.

## Visual acceptance criteria
- [ ] The primary task is obvious on every screen.
- [ ] The UI shows the thesis and signature element, not generic defaults.
- [x] No hardcoded colors or fonts outside the tokens file (`scripts/check-design-drift.sh` is clean).
- [x] Layout works at 375, 768, and 1280px (screenshots in `design/shots/`).
- [ ] Focus, contrast, labels, and keyboard behavior checked.
- [ ] Loading, empty, error, and success states exist.
