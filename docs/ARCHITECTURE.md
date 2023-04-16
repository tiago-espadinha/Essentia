# Architecture

## Stack and runtime
- Language/framework: TypeScript 6 and React 19 in every app, built with Vite 8.
- Runtime and version: the browser at run time; Node 24 or later to build (`.nvmrc`).
- Package manager: pnpm 11 workspaces with turbo; shared dependency versions in the `catalog` in `pnpm-workspace.yaml`.
- Entry points: `apps/<app>/index.html` and `src/main.tsx` per app. Every production build emits its manifest and scoped `sw.js` through `scripts/pwa.ts`.

## Boundaries
```text
apps/
  hub/       /          lists the apps and builds 404.html; in dev it proxies every app onto port 5100
  acta/      /acta/     tasks; synced when signed in
  folio/     /folio/    rich-text notes, on the device only
  virtus/    /virtus/   habits; installable PWA; optional sync
  dictum/    /dictum/   markdown documents; optional sync and share links
  aurum/     /merces/   income, expenses, budgets, recurring items; needs an account
packages/
  config/    shared TypeScript and ESLint configs
  tokens/    design tokens, fonts and base styles (one CSS import)
  ui/        theme, accent and locale preferences/selectors, formatting, Dialog
  supabase/  the one Supabase client, auth hooks, sign-in form, account menu
scripts/
  assemble.mjs   copies each app's dist/ into one dist/ (hub at the root)
```

- There is no server of our own. Every app is a static bundle; the only backend is one Supabase project (Auth and Postgres).
- The hub Accent selector saves a validated Terracotta/Blue/Violet ID under `essentia-accent`. Each app loads the same blocking external startup script through a public symlink before styles/modules; it applies the saved palette and listens for cross-tab changes. Unknown/missing values default to Terracotta. Failed writes keep the current-page choice with feedback; preferences never sync to accounts.
- All apps share one origin, so they share the theme choice (`essentia-theme` in localStorage) and the Supabase session.
- The hub Language selector stores `en-GB` or `pt-PT` under `essentia-locale`.
  A blocking shared startup script sets HTML `lang` and handles cross-tab changes.
  Missing/invalid/unreadable preferences use English without language detection;
  failed writes retain the current-page language with unsaved feedback. React
  subscriptions update existing views without remounting editors or dialogs.
  Each app owns its Portuguese message catalog; missing keys fall back to English.
  Catalog tests check literal message coverage and interpolation parity.
- Locale changes only presentation: Intl formats calendar dates, counts and EUR
  amounts. Stored ISO dates, cents arithmetic, Monday-first weeks, sorting, user
  content and CSV/input grammars stay compatible. Finance accepts comma and point
  decimals; numeric habit inputs retain their point-decimal parser. Export
  filenames and CSV machine values remain stable. Browser-owned controls follow
  browser/OS locale settings.
- Apps do not import each other; anything shared lives in `packages/`.

## Source folders

Apps and shared TypeScript packages use the same folders inside `src/`, creating
only the folders they need:

| Folder | Contents |
|---|---|
| `components/` | React rendering components and their view-specific types |
| `hooks/` | React hooks that connect state, domain functions and persistence |
| `domain/` | Non-React rules, calculations, formatting and app metadata |
| `data/` | Storage, sync, remote clients and authentication integrations |
| `tests/` | Existing unit/integration tests and their rendering or fake-server helpers |

Keep `App.tsx`, browser entry points (`main.tsx` and the hub's `notFound.ts`),
package public `index.ts` files, declarations and app/package styles at the source
root. Components import these root styles by relative path. Import app internals
directly from their folder; shared package consumers continue using the package's
public exports. Config-only and CSS-only packages keep their existing layout.

## Installation and offline boundaries

The hub and all five current apps have independent manifest identities and start
URLs: `/`, `/folio/`, `/acta/`, `/virtus/`, `/dictum/` and `/merces/`. Legacy
`/aurum/` advertises the canonical Merces manifest and registers its worker at
`/merces/`; it has no separate install identity. Existing Virtus installations
retain their resolved start-URL identity, `/virtus/`.

`scripts/pwa.ts` generates a static-file allowlist and content-derived worker
version for each build. The root worker answers only the hub's own navigation
and static files, even though its registration scope is `/`. App workers answer
only their own entry navigation and allowlisted files. Virtus retains the
`virtus-` cache prefix; other entries use independent `essentia-<app>-` prefixes.
No worker stores runtime responses, API/auth replies, shared document data or
rendered user records. Account ownership and sign-out cleanup remain in the
existing application storage/auth layer.

A successfully installed worker serves its entry and assets from the same build.
Updates wait until their controlled pages close; there is no forced activation
or reload. A failed precache is removed without replacing the working version.
Activation removes only that target's obsolete caches. Cache eviction by the
browser can still require another online visit.

After an online visit has installed the worker, the hub, Folio, Acta, Virtus and
Dictum editor reopen offline with existing device-local behavior. Installing the
hub does not precache the other apps. Shared Dictum navigation remains network
only, with a static, localized retry page when unreachable. Merces's cached shell
shows connection-required feedback when the browser reports offline; all finance
write controls and late mutation callbacks are unavailable until reconnecting.
Existing unsynced records are retained. This does not add a finance offline queue
or change existing sync conflict rules. Browser online status is a connectivity
hint; service outages continue to use existing sync-failure feedback.

## Data
- Stores: each app keeps its data in localStorage (`essentia-<app>-*` keys). Acta, Virtus, Dictum and Merces also keep a copy in Supabase Postgres for the signed-in user.
- Notes: Folio keeps every note in `essentia-notes` (each rich text or markdown, with an optional folder) and device versions in `essentia-notes-versions`. Folders are a name on each note; `essentia-notes-folders` also keeps folders that hold no notes, and `essentia-folio-sidebar` remembers whether the folder sidebar is hidden. On each load it takes in Folio's old `essentia-folio-notes` and Dictum's documents made while signed out, with their versions; those keys are only read, never changed. Ids are kept, or derived from a SHA-256 of the old id when they are not UUIDs, so a re-run adds nothing twice; a source edited after the move comes back as an "(earlier copy)" when the note has also changed. `essentia-notes-migration` records what was taken in and is written last; Dictum reads its `moved` list to show those documents only as links to Folio. If the notes cannot be written, Folio shows them read-only with Export all (one JSON file) and tries again on the next load. Removing the `essentia-notes*` keys returns both apps to their original data.
- Key entities:
  | App | Tables |
  |---|---|
  | Acta | `acta_tasks` (versioned; written only through `acta_write_task`), `acta_operation_receipts` |
  | Virtus | `habits`, `check_ins` (one row per habit and day) |
  | Dictum | `documents` (with an optional `share_id`) |
  | Merces | `transactions`, `budgets`, `recurring_transactions` |
- Sync: the device copy is the working copy. On sign-in, after changes (once edits pause for a moment), when the page comes back into view and when the browser goes online, the app merges the two copies record by record: the newer `updated_at` wins. Deletions are stamps (`deleted_at`, or a check-in value of 0), never hard deletes, so other devices learn about them. A failed sync keeps the local copy and offers a retry.
- Acta sync is the exception to newer-wins. Each account's copy lives under its own key (`essentia-acta-account:<user>`) with the server's rows as last seen, this device's order, and a queue of unsent writes. Every write names the server version it was based on and carries an operation ID, so a retry after a lost answer is applied once. A write based on an older version comes back as a conflict: the task's row says it changed on another device and offers Keep mine (send it again over the newer version) or Use theirs; the unsent change is kept until the person chooses, and a conflict where both sides already agree settles by itself. Deletion writes an empty version (a tombstone) and Undo writes a new one. Tasks new to a device are ordered by the server's `created_at`, newest first. On first sign-in with tasks made while signed out, the person adds them (each mapped once to an account id, so an interrupted claim never duplicates) or keeps them on the device, where they come back after sign-out. A sync started for one account drops its results once another signs in, and the write function refuses a write whose stated owner isn't the caller.
- The hub reuses the shared client, session hook and account menu. It cannot certify
  another app’s sync: hub sign-out requires a separate discard confirmation and
  links to Acta, Virtus, Dictum and Merces to check/retry sync first. Device-local sign-out
  clears account-owned copies across those apps, including unsynced work and
  Dictum’s device-only versions; unowned work and other devices’ sessions stay.
- Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the hub shows Account
  unavailable; app sign-in is hidden, Acta, Virtus and Dictum stay on the device, and
  Merces shows that it is not set up.
- Ownership and authorization rules: row level security on every table, `user_id = auth.uid()` for every read and write; the anon key alone reads nothing. Table and column grants are narrowed (no `truncate`; Dictum's `share_id` and Merces's recurring `posted` counter cannot be written by clients). Only the publishable (anon) key is in client code, so RLS is the security boundary.
- Server functions (Postgres, `security definer`, fixed `search_path`):
  - `share_document(document_id)` / `unshare_document(document_id)`: the owner turns a document's read-only link on or off.
  - `get_shared_document(link_id)`: anyone with the link reads that one document's title and content.
  - `acta_write_task(p_owner, p_operation_id, p_task_id, p_expected_version, p_content)`: Acta's only write. It checks the owner and the task's shape, serializes each account's writes, answers a repeated operation ID from its receipt, and applies the write or returns the newer version as a conflict. Receipts older than 30 days are pruned; a retry that late meets the newer version and settles as already done.
  - `process_due_recurring(p_today)`: Merces calls it at the end of each sync; it posts every due occurrence of the caller's recurring items once, skipping paused periods, and catches up missed periods.
- Migrations and seed strategy: one SQL file per app, `apps/{acta,virtus,dictum,folio,aurum}/supabase/migration.sql`, run once each in the Supabase SQL editor. They are independent of each other, except Folio's: it adds `format` and `pinned` to Dictum's `documents` table and a `note_folders` table for kept folders, so it runs after Dictum's. No seed data.

## APIs and integrations

Shared account settings verify a confirmed email identity with `getUser` before
password changes, then send current/new passwords to Supabase Auth. Email
identities can also be passwordless. Ordinary changes first verify the current
password through an isolated password grant for the server-verified email, require
the returned account to match, and revoke the temporary verification session with
local scope before the update. Failure or uncertain cleanup stops the update.
Neither the grant nor cleanup writes or replaces the suite session. A lost grant
response can leave an unknown temporary server session; there is no automatic
retry. OAuth-only, SSO-managed, anonymous and phone-only accounts receive an
unsupported explanation. Reauthentication requests an email nonce explicitly,
and submits it with the update when required. Server password and verification
settings remain authoritative; client validation is usability feedback.

Recovery email links return to the same-origin hub root. The hub reacts to the
SDK `PASSWORD_RECOVERY` event, not a URL flag, and offers new/confirmation fields.
Invalid or expired links offer another email request with neutral account-existence
feedback. Recovery retains the SDK’s existing session persistence; closing the
form leaves that session signed in. Forms discard passwords/codes on close,
identity change and success. Recovery explicitly explains that it can establish
a password for an email account that previously used sign-in links. Mutations
recheck identity and suppress late results
after an observed account change. Each mutation uses the captured session token
verified by `getUser(token)`, rather than asking the mutable shared SDK client to
read its current session again. Bound requests use the existing timeout transport
against Auth `/user` and `/reauthenticate`; they do not rotate refresh tokens or
write a replacement session. An already-sent request cannot be undone by
closing a tab or changing accounts. A lost update response is reported as uncertain
and never automatically resubmitted. Raw service errors and credentials are not
written to app logs or persistent app storage. Browser password managers remain
under the user’s control.

| Route or integration | Purpose | Auth and validation | Failure behavior |
|---|---|---|---|
| Supabase Auth (email and password) | One session for the suite | Supabase; password rules set in the dashboard | Plain error in the form; Virtus and Dictum stay usable signed out |
| Supabase REST (`/rest/v1/<table>`) | Sync Virtus, Dictum and Merces records | RLS and grants; table `check` constraints; the apps validate rows they read | Local copy kept; status in the account dialog, and a notice with Try again on the page |
| `rpc/get_shared_document` | Read a shared Dictum document at `/dictum/shared/<id>` | Anyone holding the link; returns nothing once unshared | "This document isn't shared any more." |
| `rpc/process_due_recurring` | Post Merces's due recurring items | Signed-in user; only their own items; `p_today` within a day of the server's date | Retried on the next sync |
| Google Fonts | Instrument Sans, Instrument Serif, JetBrains Mono, Lora | None | System fonts |

## Configuration
- Env var names: see `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Vite reads them in dev and at build time, from `apps/<app>/.env.local` locally (`apps/hub`, `apps/virtus`, `apps/dictum`, `apps/aurum` for Merces) or from the Vercel project's env vars. Use the same project configuration in each.
- Local development: `pnpm dev` runs every app on its own port (5101-5105) and the hub on 5100, which proxies each `/<app>/` so the suite runs on one origin as in production.
- Staging and production: Vercel builds with `pnpm build` and serves `dist/`. `vercel.json` sets the security headers (CSP, HSTS, X-Frame-Options and others), the Dictum rewrite for share links, and `noindex` on shared documents. The CSP `connect-src` names the Supabase project's origin, so it must change with `VITE_SUPABASE_URL`.

## Testing and CI
- Unit and integration: Vitest with jsdom (React rendered with `createRoot` and `act`) in every app except the hub, and in `packages/ui` and `packages/supabase`. The shared Supabase tests also render the hub account adapter and exercise the suite sign-out flow. Sync is tested against an in-memory fake of the Supabase tables. Accessibility checks run axe-core on each app's main states.
- E2E: none.
- CI: none; the checks run locally.

## Finance identity compatibility

Merces uses `/merces/` for hub navigation and built assets. `/aurum/` remains a
static copy of the same entry; the hub development proxy rewrites it to `/merces/`.
Query strings and fragments remain on the visited URL. The `apps/aurum` directory,
`aurum` workspace package, `essentia-aurum-*` keys, Supabase tables and shared
authentication session retain their identifiers. No data is migrated or removed.
Signup confirmation now requests `/merces/`; allow this destination alongside old
`/aurum/` links in Supabase URL configuration (see the README setup steps).

## Keyboard search

The shared header search opens with Ctrl+K (Cmd+K on macOS) or its visible control.
The hub and anonymous shared-document pages search suite destinations only. Each
working app additionally supplies its existing in-memory records: tasks, notes,
habits, markdown documents or transactions. Matching is case-insensitive across
the record title and its text/category/tag fields; the dialog renders at most
20 record matches and reports the total. Selecting a record clears filters that
would hide it and moves focus into its existing editor or row.

Search owns no storage, index, network requests or query history. Existing app
hooks retain authority over local and account data. Session changes reset the
dialog and its query; offline or signed-out finance exposes destinations only.
Already accessible local and unsynced records remain searchable in apps that
support local use. Search does not read another app’s storage or include shared
document contents. A native modal traps focus, Escape restores the opener, and
other open modals retain shortcut ownership. Existing editor handlers take priority,
including Dictum’s Ctrl+K/Cmd+K link shortcut in the markdown body. Opening
search preserves unsubmitted metadata drafts instead of committing them on blur.
