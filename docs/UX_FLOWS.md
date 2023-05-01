# UX Flows and Screen Inventory

The inventory below describes the current implementation: four apps, with Dictum now part of Folio. The revised
four-app destination is specified separately below; it is not yet delivered.

## Current primary journey
**User goal:** do one everyday thing (a task, a note, a habit check-in, some writing, a transaction) quickly, in a calm interface.

1. Entry point: the hub at `/`, or an app URL directly (`/acta/`, `/folio/`, `/virtus/`, `/merces/`; former `/aurum/` links still work, and `/dictum/` points to Folio).
2. Action: the app opens on its main view with the primary action visible (add task, new note, check in, new document, add transaction).
3. System feedback: the item appears immediately; saved locally, and synced when signed in (Folio, Acta, Virtus, Merces).
4. Next decision: continue in the app, or go back to the hub from the header.
5. Success state: the item persists after reload and, when signed in, on another device.
6. Recovery if something fails: inline error with retry; local data is never discarded on a sync failure.

## Secondary journeys
- Sign in from the hub or a synced app (Supabase) and stay signed in across
  Folio, Acta, Virtus and Merces (shared session on one origin). The hub shows account
  loading or unavailability explicitly. Its Account dialog links to each app to
  check sync before sign-out. Sign out opens a separate discard warning; Cancel
  or Escape keeps the session and work. Confirming clears account-owned device
  copies, including unsynced changes and Dictum versions, while preserving work
  made signed out and other devices’ sessions. Pending feedback prevents repeated
  requests; failure keeps the dialog open with retry.
- Choose Accent in the hub header (Terracotta, Blue or Violet); it applies to every app and open same-origin tab and survives reload when browser storage is available. If saving fails, inline feedback explains the current-page-only choice.
- Switch theme in any app; the choice applies to every app (`essentia-theme`).
- Folio: share a note and open the link at `/folio/shared/<id>` while signed out; older `/dictum/shared/<id>` links open the same view.
- Merces: recurring items post when the app syncs, catching up any missed periods.
- Merces: a weekly item names its weekday and first payment; a first payment on another weekday is refused, with the next matching day offered, and the form previews the first dates it will post.
- Merces: Plan lists every category in use with what uses it. Renaming one changes it on every transaction, recurring item and budget; renaming into an existing name merges the two, keeping that category's budget; removing one moves its uses to a chosen category. Nothing is deleted, and the dialog says what will move before it does. Quick-add files a line under any category the account uses and says which before it is added. Insights ends with eight badges for keeping records and planning: entries counted (1, 50, 250), months in a row with something recorded (3, 12), a first budget, a first recurring item and a finished month with more coming in than going out. They are read from the account as it is now, so imports count at once, deleting the records behind one takes it away, and no badge rewards spending more. Locked counted badges show how far along they are.
- Virtus: install as a PWA and check in offline.

## Current screen inventory
| Screen / route | User goal | Primary action | Key states | Responsive notes |
|---|---|---|---|---|
| Hub `/` | Pick an app | Open an app | Populated; empty registry | Four primary entries in two columns from 768 px, one below |
| Acta `/acta/` | Manage tasks | Add task | Empty, list, filtered (none match), completed; signed in: sync error with retry, keep-or-add question, a task changed on another device (Keep mine / Use theirs) | 520 px column |
| Folio `/folio/` | Write and find notes | New note | Empty library, list, editor (rich text, or markdown edited as source), search no results, empty folder, folder name refused, delete-folder confirmation, save failed, read-only with Export all when notes can't be stored | Library (folders and tags), list and editor from 1024 px, the library hideable; list + editor from 768 px (library folds into a filter bar); one pane below 768 px |
| Virtus `/virtus/` | Track habits | Check in today | Empty, habits, streak milestone, offline | 520 px column |
| Virtus Streaks, Week, Stats views | See progress | Open a habit's stats | Not enough data | Charts reflow to one column at 375 |
| Dictum `/dictum/` | Find where Dictum went | Open Folio | Says Dictum is now part of Folio; documents on the device stay until Folio takes them in | Reading column |
| Shared note `/folio/shared/<id>`, also `/dictum/shared/<id>` | Read a shared note | Read | Loading, not shared any more, couldn't load; rich notes cleaned, markdown never renders HTML | Reading column |
| Merces `/merces/` (also `/aurum/`) signed out | Get access | Sign in / sign up | Validation, auth error, not set up (no Supabase project in this build) | 520 px column |
| Merces Transactions | Track money | Add transaction | Empty, list, filtered, loading, sync error | 520 px column |
| Merces Insights, Plan (budgets, recurring items, CSV export and import) | Plan and review | Set budget / add recurring / rename category / compare 12 weeks, 6 months or 12 months / see badges and their progress | Empty, nothing in the chosen interval, badges waiting for budgets and recurring items, over budget, paused item, weekday mismatch, import errors, export unreachable (no file) or empty account, blank or unchanged category name, merge with budget kept | Charts reflow at 375 |

## Interactions
| Interaction | Expected behavior | Keyboard / a11y | Failure and recovery |
|---|---|---|---|
| Add item (any app) | Appears at once, input clears and keeps focus | Enter submits; labelled input | Inline validation; nothing lost |
| Delete item | Removed at once with an Undo notice (Acta, Folio, Virtus, Merces); in Folio, Undo reopens the note, a shared note asks first because its link stops working, and its Undo says the link works again and offers Stop sharing; in Acta, deletion and Undo are each synced as a new version | Undo notice is a status region, so the deletion is announced | Save failure shown as an alert; the change lasts until the page closes |
| Theme toggle | Switches all apps | Button with pressed state | Falls back to system preference |
| Sign in | One form, session shared across apps | Labelled fields, errors announced | Plain error, retry; local mode still usable (except Merces) |
| Sync | Background; status in the account dialog | Status text, not only colour | Notice with Try again on the page; local copy kept |
| Share (Folio) | Generates link, copy button, stop sharing | Copy confirmed in a status region | Error with retry; if copying fails the link is selected for Ctrl+C |

## Empty, error, and no-permission content
- Empty: a serif one-liner ("Nothing on the list."), one muted sentence, and the primary action.
- Error: what happened and what to do ("Couldn’t sync with your account. Your changes are kept on this device.", with Try again beside it).
- No permission / not found: Shared links that are revoked, or whose note is deleted, show "This note isn’t shared any more." with a link to the hub. Any other unknown path outside Dictum shows the suite's 404 page, "Nothing lives at this address.", with a link to the hub.

## UX checks for every UI change
- [ ] The primary journey can be completed without guessing.
- [ ] Actions give clear feedback.
- [ ] Errors explain how to recover.
- [ ] Focus order and keyboard behavior are coherent.
- [ ] Layouts keep task priority across widths.


## Revised destination journeys

1. Open the hub and choose Folio · Your Notes, Acta · Your Tasks, Virtus · Your
   Habits or Merces · Your Money. Use a two-by-two grid on wide screens and a
   single column on mobile; keep each entry’s open action clear.
2. Open the primary working view: unified Folio writing with an explicit mode
   control, tasks, habit check-ins or finance. Current account/local-use boundaries
   continue until separately reviewed sync work is delivered.
3. Use the shared header for account access, appearance and search. Ctrl+K/Cmd+K
   is recommended for navigation/actions and active-app records. The visible
   search control must offer the same entry; results must respect account access.
   Cross-app private-content search is deferred.
4. Reload or follow a legacy app/share URL. Existing content, access restrictions,
   revocation and available version history must survive the reviewed transition.
   A failed migration must leave recoverable originals and offer retry/recovery.

### Target screen and interaction changes

| Surface | Agreed direction | Remaining decision |
| --- | --- | --- |
| Hub | Four destination entries; icons, catchphrases and open actions; account/appearance/search in header | Account, accent select, theme toggle and search implemented. Dictum left the hub and `/dictum/` points to Folio; custom app creation excluded |
| Folio | Dictum writing/preview patterns; collapsible library aside with single-level folders above the tag filter; explicit rich-text/markdown control | Syncing folders and notes to the account |
| Acta, Virtus, Merces | Use wide desktop space with comfortable reading regions, 24–32 px outer gutters and meaningful list/detail or summary areas; collapse on mobile | Exact density, pane arrangement and breakpoints require rendered review |
| Virtus Track/Schedule | Track is recommended for check-ins; Schedule for recurrence | Exact copy, target screen and disclosure behavior are TBD |
| Virtus categories | Recommend a color marker accompanied by readable category text | Assignment, affected views and interaction with accent preference are TBD |
| Virtus Streaks | Recommend removing only the dedicated navigation destination; retain history and useful statistics in habit details | Exact destination and whether mechanics change require confirmation |
| Acta/Virtus input | Recommend `#name` grouping suggestions plus equivalent form controls | Grammar, cardinality and literal/escaped/conflicting tokens remain TBD |
| Locale selection | Hub Language selector: English (UK) default/fallback and Português (Portugal); device-local across all current apps and open tabs | Regional display only; EUR, Monday-first weeks, stored content and existing input/CSV rules retained |

### Migration acceptance before retiring entry points

- Inventory both note stores, legacy keys, stable IDs, timestamps, local versions,
  tags/folders, ownership and deletion records. Do not conflate matching titles.
- Preserve `/dictum/shared/<id>` while signed out, including read-only rendering,
  revoked/not-found/error states, retry behavior and `noindex`. Canonical path `/folio/shared/<id>`.
- Keep `/dictum/` and `/aurum/` entry compatibility. `/merces/` remains proposed;
  route rewrites and internal renames need review before changing built assets.
- Preserve available Dictum versions and restore behavior; current versions are
  device-local, not synced, and cleared on sign-out. Already-cleared versions cannot
  be recovered by migration. Changing history retention/sync needs separate review.
- Test local-only and signed-in content, account isolation, repeat/interrupted
  imports, collisions, share revocation, history restore and rollback before
  removing source storage (the separate Dictum hub entry is gone).
- Keep rich text and markdown originals recoverable; review conversion and
  identity mappings before switching editor modes or merging stores.

### States and accessibility for subsequent delivery

Each new surface needs loading, empty, error/retry, success, disabled and validation
states, or a documented reason a state does not apply. Search needs empty-query,
no-results and unavailable-source states. Mode changes must explain any conversion
and preserve content on cancellation/failure. Mobile pane changes must retain a
clear back action; dialogs restore focus, Escape closes them, and color is never
the only indication. Theme and item transitions must not delay navigation or undo. Record-create/delete
motion covers tasks, notes, habits, documents and transactions; state and focus
update immediately while entering rows, remaining row positions and empty/Undo
feedback provide visual continuity. Hub-entry management is outside this change.
