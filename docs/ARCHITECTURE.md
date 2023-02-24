# Architecture

## Stack and runtime
- Language/framework: TypeScript 6 and React 19 in every app, built with Vite 8.
- Runtime and version: the browser at run time; Node 24 or later to build (`.nvmrc`).
- Package manager: pnpm 11 workspaces with turbo; shared dependency versions in the `catalog` in `pnpm-workspace.yaml`.
- Entry points: `apps/<app>/index.html` and `src/main.tsx` per app. Virtus also builds `sw/worker.ts` to `/virtus/sw.js`.

## Boundaries
```text
apps/
  hub/       /          lists the apps; in dev it proxies every app onto port 5100
  acta/      /acta/     tasks, on the device only
  folio/     /folio/    rich-text notes, on the device only
  virtus/    /virtus/   habits; installable PWA; optional sync
  dictum/    /dictum/   markdown documents; optional sync and share links
  aurum/     /aurum/    income, expenses, budgets, recurring items; needs an account
packages/
  config/    shared TypeScript and ESLint configs
  tokens/    design tokens, fonts and base styles (one CSS import)
  ui/        theme, theme toggle, back-to-hub link, Dialog
  supabase/  the one Supabase client, auth hooks, sign-in form, account menu
scripts/
  assemble.mjs   copies each app's dist/ into one dist/ (hub at the root)
```

- There is no server of our own. Every app is a static bundle; the only backend is one Supabase project (Auth and Postgres).
- All apps share one origin, so they share the theme choice (`essentia-theme` in localStorage) and the Supabase session.
- Apps do not import each other; anything shared lives in `packages/`.

## Data
- Stores: each app keeps its data in localStorage (`essentia-<app>-*` keys). Virtus, Dictum and Aurum also keep a copy in Supabase Postgres for the signed-in user.
- Key entities:
  | App | Tables |
  |---|---|
  | Virtus | `habits`, `check_ins` (one row per habit and day) |
  | Dictum | `documents` (with an optional `share_id`) |
  | Aurum | `transactions`, `budgets`, `recurring_transactions` |
- Sync: the device copy is the working copy. On sign-in, after changes (once edits pause for a moment), when the page comes back into view and when the browser goes online, the app merges the two copies record by record: the newer `updated_at` wins. Deletions are stamps (`deleted_at`, or a check-in value of 0), never hard deletes, so other devices learn about them. A failed sync keeps the local copy and offers a retry.
- Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, sign-in is hidden: Virtus and Dictum stay on the device, and Aurum shows that it is not set up.
- Ownership and authorization rules: row level security on every table, `user_id = auth.uid()` for every read and write; the anon key alone reads nothing. Table and column grants are narrowed (no `truncate`; Dictum's `share_id` and Aurum's recurring `posted` counter cannot be written by clients). Only the publishable (anon) key is in client code, so RLS is the security boundary.
- Server functions (Postgres, `security definer`, fixed `search_path`):
  - `share_document(document_id)` / `unshare_document(document_id)`: the owner turns a document's read-only link on or off.
  - `get_shared_document(link_id)`: anyone with the link reads that one document's title and content.
  - `process_due_recurring(p_today)`: Aurum calls it at the end of each sync; it posts every due occurrence of the caller's recurring items once, skipping paused periods, and catches up missed periods.
- Migrations and seed strategy: one SQL file per app, `apps/{virtus,dictum,aurum}/supabase/migration.sql`, run once each in the Supabase SQL editor. They are independent of each other. No seed data.

## APIs and integrations
| Route or integration | Purpose | Auth and validation | Failure behavior |
|---|---|---|---|
| Supabase Auth (email and password) | One session for the suite | Supabase; password rules set in the dashboard | Plain error in the form; Virtus and Dictum stay usable signed out |
| Supabase REST (`/rest/v1/<table>`) | Sync Virtus, Dictum and Aurum records | RLS and grants; table `check` constraints; the apps validate rows they read | Local copy kept; status in the account dialog, and a notice with Try again on the page |
| `rpc/get_shared_document` | Read a shared Dictum document at `/dictum/shared/<id>` | Anyone holding the link; returns nothing once unshared | "This document isn't shared any more." |
| `rpc/process_due_recurring` | Post Aurum's due recurring items | Signed-in user; only their own items; `p_today` within a day of the server's date | Retried on the next sync |
| Google Fonts | Instrument Sans, Instrument Serif, JetBrains Mono, Lora | None | System fonts |

## Configuration
- Env var names: see `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Vite reads them in dev and at build time, from `apps/<app>/.env.local` locally (Virtus, Dictum, Aurum) or from the Vercel project's env vars.
- Local development: `pnpm dev` runs every app on its own port (5101-5105) and the hub on 5100, which proxies each `/<app>/` so the suite runs on one origin as in production.
- Staging and production: Vercel builds with `pnpm build` and serves `dist/`. `vercel.json` sets the security headers (CSP, HSTS, X-Frame-Options and others), the Dictum rewrite for share links, and `noindex` on shared documents. The CSP `connect-src` names the Supabase project's origin, so it must change with `VITE_SUPABASE_URL`.

## Testing and CI
- Unit and integration: Vitest with jsdom (React rendered with `createRoot` and `act`) in every app except the hub, and in `packages/ui` and `packages/supabase`. Sync is tested against an in-memory fake of the Supabase tables. Accessibility checks run axe-core on each app's main states.
- E2E: none.
- CI: none; the checks run locally.
