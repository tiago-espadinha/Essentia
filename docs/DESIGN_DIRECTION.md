# UX/UI Design Direction

Status: Approved
Tokens file: packages/tokens/tokens.css
Approved by: tiago-espadinha
Revised destination approved: 2026-11-06; explicit TBD choices below remain unresolved.
Implementation status: current tokens and screenshots predate this revision.

## Design thesis
Warm paper, quiet ink: four tools that feel like good stationery. The interface steps back so the content (tasks, notes, habits, writing, money) is what you see.

## Fit
The suite is for daily personal use, so it has to be calm enough to open many times a day, and it is shown to portfolio reviewers, so it has to look deliberate rather than templated. One editorial language across the destination apps makes the suite read as one product, while each app keeps the layout its content needs.

## Choice and alternatives
- Chosen: retain the existing editorial language while revising the hub, readability and wide layouts for Folio, Acta, Virtus and Merces. Dictum folds into Folio; Aurum becomes Merces through separately reviewed compatibility work.
- Alternatives considered: a redesign (`create` mode); per-app accent colours.
- Revised accent direction: terracotta remains the default; offer a curated set of suite-wide palettes after light/dark contrast verification. Approved palettes are Terracotta (default), Blue and Violet; a hub header selector stores the device-local preference under `essentia-accent`, shared across apps and open tabs on the same origin. Account sync is excluded. Arbitrary color selection is not included.
- Trade-offs: apps are told apart by name, serif title and icon, not colour.

## References
`design/refs/` is empty. The references are the existing apps and the original mockups in `docs/specs/` (`todo-design-6.html`, `design-1-editorial.html`, `habit_tracker_ui.html`, `markdown_editor_ui.html`, `personal_finance_ui.html`): borrow the serif display titles, hairline rules and generous whitespace; revise essential labels for readability.

## Principles
1. Content first: chrome is quiet, flat, and uses hairlines rather than boxes and shadows.
2. One suite: same tokens, theme, type and controls in every app; layouts differ only where the content needs it.
3. Readable by everyone: WCAG 2.2 AA contrast, 11 px minimum text, full keyboard use.

## Visual language
- Tone: calm, editorial, warm, unhurried.
- Typography:
  - Instrument Serif: display and headings (app titles, section titles, large numbers).
  - Instrument Sans: UI and body text (`--text-sm` 14 px for UI, `--text-md` 16 px for reading).
  - JetBrains Mono: short technical metadata only; existing 11 px metadata tokens are not the default for interactive labels. Essential controls use Instrument Sans, sentence case and at least 14 px; avoid light-weight, widely tracked uppercase controls. Any font-family replacement remains TBD.
  - Lora: Folio's editor body only.
  - Scale: 11 / 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 px. Nothing below 11 px.
  - Playfair Display is retired.
- Color roles (light / dark):
  - Background `--color-sand` #F2EDE6 / #1A1816; surface `--color-paper` #EDE8E0 / #222019.
  - Text `--color-ink` #2A2520 / #E8E3DC; muted `--color-mid` #6F665D / #9A9087.
  - Decorative lines `--color-faint` #DDD8D0 / #2F2C28; control borders `--color-line-strong` #8A8076 / #7A7168.
  - Default primary action and accent fill `--color-terracotta` #B8572A / #D4764A, with `--color-on-accent` #FFFFFF / #1A1816.
  - Accent text and links `--color-accent-text` #A24B23 / #D4764A.
  - Alternate accent roles (light fill / light text and focus / dark fill, text and focus): Blue #34689B / #285A89 / #7AADE0; Violet #76549E / #68458F / #B99ADB. The legacy `--color-terracotta` token follows the selected palette.
  - Status: success #3F6B4C / #6AAF7D; danger #B23F3F / #E06060.
  - Category markers (decorative, beside the category name; light / dark): ochre #8A6412 / #D9A94A, teal #1F6F6B / #5BBDB5, rose #A63D6B / #E58AB0, olive #5E6B1E / #AEBB5E, slate #4F5D6E / #A3B1C2, umber #5E4330 / #9C7A66; neutral = muted. Each is 3:1 or better on sand and paper; the accent preference does not change them.
  - All text pairs are 4.5:1 or better; control borders 3:1 or better (ratios in the tokens file).
- Spacing scale: 4 px base: 2, 4, 8, 12, 16, 24, 32, 48, 64, 96 (`--space-*`).
- Borders, radius, elevation: 1 px hairlines in `--color-faint`; radius 6 / 10 / 14 / full; flat by default, `--shadow-overlay` only for popovers, menus and dialogs.
- Iconography: simple line icons, 1.5 px stroke, `currentColor`, 16 and 20 px; always paired with a text label or an `aria-label`.
- Motion: use existing `--duration-fast` 150 ms and `--duration-normal` 250 ms for brief theme and app-entry transitions. Theme palettes switch immediately to preserve contrast; the theme icon and paper grain provide continuity rather than interpolating text and background colors. Record-create/delete transitions are approved for tasks, notes, habits, documents and transactions: animate entering records and the resulting row reflow or empty/Undo feedback, with immediate state updates. Do not delay navigation, focus, feedback or undo; zero nonessential motion under `prefers-reduced-motion`. Finance chart bars ease to new values over `--duration-normal` with `--ease` when the interval changes, never on first draw; labels and the table switch at once, and the bars stay still under `prefers-reduced-motion`. Custom app-management motion and other decorative chart motion need separate decisions.
- Imagery: none; data visualizations (heatmap, charts) use the accent, ink and mid tokens.
- Content voice: short, plain, lowercase-friendly labels; no exclamation marks; errors say what happened and what to do.

## Signature element
A faint paper grain over every app (`body::before`, SVG noise at `--grain-opacity` 0.04, `pointer-events: none`), off in dark mode. It makes the suite feel like paper without costing legibility.

## Rules
- **Do:** use serif titles, readable sentence-case controls and restrained technical metadata to create hierarchy; separate with hairlines and whitespace; keep one primary action per view using the selected suite accent; use `--color-accent-text` for accent-coloured text; share the theme toggle and back-to-hub link.
- **Avoid:** per-app colour schemes or new hex values in app CSS; drop shadows on cards; text below 11 px; muted text in `--color-faint`; `--color-faint` as an input border; Playfair Display; component-library default looks.

## Components and patterns
| Component | Purpose | Rules and states |
|---|---|---|
| App header | Serif app title, back-to-hub link, theme toggle (`@essentia/ui`: toggle button, moon in light mode and sun in dark mode, pressed = dark) | Same in every app; sticky in column apps |
| Primary button | The one main action | Selected suite accent (terracotta by default), `--color-on-accent` text, radius-sm; hover, active, focus ring, disabled, loading |
| Secondary / ghost button | Other actions | Transparent, ink text, `--color-line-strong` border on focus/hover |
| Text input, select, textarea | Data entry | `--color-line-strong` border, radius-sm, label above, inline validation in danger colour |
| Metadata label | Short technical metadata | Mono may be used at 11 px minimum; interactive labels use sentence-case Sans at 14 px minimum; `--color-mid` with verified contrast |
| List row | Tasks, transactions, habits, notes | Hairline separators, no cards; hover tint `--color-paper`; selected state with accent bar |
| Dialog / popover | Confirm, share, forms | `--color-paper`, radius-lg, `--shadow-overlay`, focus trapped, Esc closes |
| Empty state | First use | Serif one-liner, one sentence in muted text, primary action (exceptions, user decisions 2026-10-16: the hub before any app exists has no action; when the view's own add field sits directly above the empty state, that field is the action and no button repeats it, as in Acta) |
| Toast / inline error | Feedback | Plain text, status colour, retry action where it applies |

## Responsive behavior
- 375px: full-width working views with 16 px gutters, no horizontal page overflow,
  and touch targets at least 44 px. Folio uses one pane at a time with a back control.
- 768px: preserve clear task priority and readable text. Folio can show list/editor;
  exact pane breakpoints for the unified workspace remain TBD.
- 1280px and wider: Acta, Virtus and Merces use available desktop width with
  24–32 px outer gutters and meaningful list/detail or summary regions. Constrain
  reading/editing line lengths rather than forcing a single narrow page column.
- Approved working layout: Acta, Virtus and current Aurum use a two-column
  overview/workspace from 1024 px, with an 18–22 rem overview, 48 px column gap,
  hairline divider and 32 px outer gutters. The overview contains existing progress
  or money summaries; forms, filters and content follow in the workspace. Keep
  add/edit forms at most 520 px and prose at most 65 characters per line. Below
  1024 px, stack in source order with 16 px phone and 24 px tablet gutters. Wide
  habit/week and finance/month tables scroll inside labeled, keyboard-focusable
  regions. Within sufficiently wide workspaces, arrange habit statistics and
  finance planning/insights in two columns. Signed-out finance retains a readable
  form width. Finance naming and routes remain part of separate compatibility work.
- Hub: two-by-two destination grid on wide screens, one column on mobile. Show
  icon, name, catchphrase and one open action per entry; keep shared account,
  appearance and search controls in the header.
- Folio: Dictum-inspired writing/preview workspace and collapsible library aside;
  rich-text/markdown mode control. The aside holds search, All notes, Unfiled and
  single-level folders with counts, then the tag filter; from 1024 px a list-header
  toggle hides it and the choice is remembered on the device. Below 1024 px it folds
  into the Filter bar. A note's folder is picked in the editor's details row.
  Below 1024 px the editor bar keeps to two rows: Convert, Versions and Delete fold
  into a More menu beside Pin, the formatting toolbar sits below, and on phones Pin
  and More show only their icons.
  Keep separate Dictum discoverable until safe.
- Navigation: retain the header’s back-to-hub link at every width. Validate exact
  breakpoints, density, reading order and pane controls in the implementation’s
  rendered review; the historical centred-column screenshots do not prove this target.

## Accessibility
- Keyboard and focus: every action reachable by keyboard; visible 2 px focus ring in `--color-focus` with 2 px offset; dialogs trap focus and restore it.
- Semantics and labels: landmarks (`header`, `main`, `nav`); real buttons and inputs; labels on every control; charts and the heatmap have text alternatives.
- Contrast: WCAG 2.2 AA; ratios recorded in the tokens file.
- Reduced motion: durations drop to 0 under `prefers-reduced-motion`.

## UI states
Loading / Empty / Error and retry / Success / Disabled / Validation / Permission denied: every data view has loading (quiet skeleton lines, no spinners over 300 ms waits), empty (see component), error with retry, and success feedback; disabled controls keep 3:1 borders; validation is inline under the field; signed-out states in current Aurum (destination Merces) and synced views explain sign-in with one action.

## Deferred design choices

The theme-toggle SVG target is confirmed: show a moon in light mode and a sun in
dark mode, offering the other theme. Keep the stable Dark theme accessible name
and pressed state (pressed means dark); decorative SVGs use currentColor and
are hidden from assistive technology. The owner accepted the existing typography;
no typography changes are required for this correction.

Item create/delete means records inside each app (owner clarification): tasks, notes,
habits, documents and transactions. Brief motion is approved; it must preserve
existing storage, sync, deletion, Undo and focus behavior. Custom app creation or
hub-entry management is excluded. Virtus labels its habit settings "Repeats" and "Log as";
the exact Streaks destination remains TBD. Category markers are an 8 px dot before the category name in habit rows and
filter chips, and the Stats bar fill; the text carries the meaning, the dot is hidden from assistive technology and keeps
an outline in forced colors. Six marker tokens (`--color-category-1` to `-6`: ochre, teal, rose, olive, slate, umber) are
assigned automatically, and the default category is a neutral ring. They remain distinct from success/danger and every accent. New palettes
require verified text (4.5:1), control and focus (3:1) contrast in both themes.

## Accent preference

Choose Accent in the hub header; native named options work with keyboard and touch.
The choice applies immediately and before rendering each app on reload. Invalid,
missing or removed preferences fall back to Terracotta. Blocked reads use the
default; a failed save keeps the current-page choice and shows unsaved feedback.
Cross-tab changes and storage clearing update the palette. Semantic status and
category colors retain their meaning. Palette switching has no color animation.

## Locale preference

The hub header offers a native Language selector with English (UK) and Português
(Portugal), using their self-names. English is the default and fallback without
browser-language detection. Selection updates all current apps and open tabs on
the same origin; it stays on this browser rather than the account. Failed saves
keep the current-page language and explain that it could not be saved. Labels
wrap naturally at narrow widths, and changing language retains focus and edits.
Translate application-owned copy and accessible names, including existing Dictum
and shared pages; user content, category names and export formats stay unchanged.
Dates and numbers follow the selected locale; currency remains EUR. Existing
numeric input rules and Monday-first weeks remain compatible. Browser-owned
pickers and validation follow browser settings.

## Historical visual acceptance evidence

These checks describe the previous implementation, not acceptance of the revised
hub, typography, palettes or layouts. Subsequent UI work needs fresh evidence.

- [ ] The primary task is obvious on every screen.
- [ ] The UI shows the thesis and signature element, not generic defaults.
- [x] No hardcoded colors or fonts outside the tokens file (`scripts/check-design-drift.sh` is clean).
- [x] Layout works at 375, 768, and 1280px (screenshots in `design/shots/`).
- [x] Focus, contrast, labels, and keyboard behavior checked. (Tab walk at 768, light and dark, on every app; Aurum signed out only. Its signed-in screens passed axe but have had no Tab walk.)
- [ ] Loading, empty, error, and success states exist.
