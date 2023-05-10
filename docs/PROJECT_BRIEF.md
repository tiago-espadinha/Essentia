# Project Brief

## Product in one sentence
Essentia’s revised destination is four everyday productivity tools—Folio notes and markdown writing, Acta tasks, Virtus habits, and Merces personal finance—sharing one design language and a landing hub, built mainly for the author’s personal use and shown as a portfolio piece.

This is the agreed product direction, not a statement of completed implementation. The hub lists four apps: Dictum is now part of Folio, and `/dictum/` says so and links there. Merces retains the internal `aurum` identifiers.

## Audience and context
- Primary user: the author, in daily personal use.
- Secondary audience: people reviewing the portfolio.
- Context of use: desktop and mobile browsers. Each app works on its own; the hub at `/` is one way in.

## Outcomes
- User outcome: four reliable everyday tools in one consistent, calm interface, with existing data and links preserved during consolidation.
- Project outcome: a polished, deployed portfolio piece.
- How success is judged: build, lint, typecheck, tests and `pnpm audit` all clean (zero known vulnerabilities); one visual language across apps; WCAG 2.2 AA; live on Vercel.

## Current user journeys
1. Open the hub, pick an app, use it immediately (Folio, Acta and Virtus work locally without signing in).
2. Sign in once (one Supabase project, shared session across the suite) and have Folio, Acta, Virtus and Merces data available across devices.
3. Merces: record income and expenses, set budgets, create recurring items that post when the app syncs, review summaries and charts.
4. Folio: write rich or markdown notes, keep version history, share a read-only link at `/folio/shared/<id>`; older `/dictum/shared/<id>` links open the same view.

## Requirements
- Must have in the current baseline: all five apps and the hub working; shared `@essentia/tokens` design system across all apps; Merces built on Supabase (Auth + RLS); Virtus habits and Dictum documents synced to Supabase; current dependency versions with zero known vulnerabilities; lint, typecheck, test and build passing; no open security findings; deployed on Vercel.
- Should have: tests and an accessibility pass per app; dark mode in every app; UX tweaks where they help users or features.
- Later / out of scope: CI; E2E tests; native apps; collaboration; bank imports; a daily `pg_cron` job for recurring items.

## Constraints
- Required stack or integrations: pnpm + turbo monorepo; Vite + React 19 + TypeScript in every app; Supabase (free tier, one project); Vercel.
- Data, privacy, and security: personal finance data and notes. RLS on every table; only the anon key in client code; no secrets in the repo.
- Accessibility: WCAG 2.2 AA.
- Deployment target: Vercel, static `dist/` on one origin, each app under `/<app>/`.

## Where it lives
- Code: `apps/` (one folder per app), `packages/` (tokens, ui, supabase, config), `scripts/assemble.mjs`.
- Live: https://essentia-beta.vercel.app/
- Architecture: `docs/ARCHITECTURE.md`; flows and screens: `docs/UX_FLOWS.md`.

## Current baseline acceptance
Visiting the deployed hub lets you use the four apps on one design system (Dictum is now part of Folio), with sign-in and synced data in Folio, Virtus and Merces, working share links, clean checks, and no known vulnerabilities.


## Revised destination

| App | Catchphrase | Role |
| --- | --- | --- |
| Folio | Your Notes | Notes and markdown writing, incorporating Dictum |
| Acta | Your Tasks | Task management |
| Virtus | Your Habits | Habit tracking |
| Merces | Your Money | Renamed Aurum finance app |

The target hub uses four entries in a two-by-two desktop grid and one mobile
column. Each entry has its icon, name, catchphrase and one clear open action.
Shared account, appearance and search controls belong in the header. Existing
Dictum left the hub once unified Folio synced and shared notes; `/dictum/` points to Folio.

Folio adopts Dictum’s writing workspace with a collapsible library aside and an
explicit rich-text/markdown mode control. The existing Folio editor is rich text;
plain text, rich text and markdown are not interchangeable storage formats.
New notes are rich text; converting a note is an explicit, confirmed action.
A note sits in at most one folder and keeps its tags: folders do not nest, and
tags and folders are never converted into each other. Empty folders persist.
Switching modes must not silently overwrite or convert content.

Acta, Virtus and Merces use available desktop width while keeping reading and
editing comfortable. Shared typography favors readable sentence-case controls;
accent personalization uses curated, contrast-checked suite-wide palettes with
terracotta as default. Motion remains brief and respects reduced motion.
See [design direction](DESIGN_DIRECTION.md) and [flows](UX_FLOWS.md) for boundaries.

## Compatibility and decisions before implementation

- Preserve existing Folio notes, Dictum documents, stable identities, timestamps,
  ownership, deletions and available local version history. Do not merge by title.
- Preserve `/dictum/shared/<id>` links, anonymous read-only access, revocation and
  `noindex`; the canonical path is `/folio/shared/<id>`. Keep `/dictum/` entry compatibility.
- Preserve existing `/aurum/` URLs and finance data. `/merces/` is a proposed new
  entry; route/package/storage migration choices require separate review.
- Define retryable, idempotent migration, conflicts, backup, failure recovery and
  rollback before any migration. Do not delete old storage or tables on a rename.
- Dictum versions currently exist only on the device and are cleared on sign-out;
  do not promise recovery of already-cleared history. History sync/retention needs
  its own reviewed decision.
- Recommend Ctrl+K/Cmd+K for suite navigation/actions and active-app record search;
  whole-suite private-content search is deferred pending ownership/indexing rules.
- Recommend `#name` for Acta/Virtus grouping, with suggestions and equivalent form
  controls. Quoting, spaces, escaping, repetition, literal hashes and conflicts are
  TBD. Dates/priorities/schedules use explicit controls initially.
- Locale scope approved: English (UK), the default and fallback, and Portuguese
  (Portugal), selected in the hub and stored on this browser across current apps.
  Dates/numbers use selected regional formats; EUR, Monday-first week views,
  existing numeric/CSV parsers and stored user content remain unchanged.
- Account changes, additional sync, install targets and individual app improvements
  need bounded follow-on designs. This direction does not authorize security,
  retention, migration or deployment changes.

The font complaint is resolved: the owner accepts the existing typography. The
confirmed SVG target is the shared theme toggle: moon in light mode and sun in dark
mode, with its accessible toggle behavior retained. The remaining ambiguous requests
stay explicit: item create/delete refers to records within each app (tasks, notes,
habits, documents and transactions), with brief motion approved and current data/Undo
behavior preserved; custom app management is excluded; Virtus habit settings read "Repeats" and "Log as", and its list filters sit behind a "Search and filter" toggle; category marker
color is recommended but assignment/scope are TBD; Virtus drops its Streaks view
(the owner confirmed it is that tab) and keeps every streak figure, badge and the
habit history. None of these deferrals authorizes destructive behavior.
