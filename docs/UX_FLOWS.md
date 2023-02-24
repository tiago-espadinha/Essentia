# UX Flows and Screen Inventory

## Primary journey
**User goal:** do one everyday thing (a task, a note, a habit check-in, some writing, a transaction) quickly, in a calm interface.

1. Entry point: the hub at `/`, or an app URL directly (`/acta/`, `/folio/`, `/virtus/`, `/dictum/`, `/aurum/`).
2. Action: the app opens on its main view with the primary action visible (add task, new note, check in, new document, add transaction).
3. System feedback: the item appears immediately; saved locally, and synced when signed in (Virtus, Dictum, Aurum).
4. Next decision: continue in the app, or go back to the hub from the header.
5. Success state: the item persists after reload and, when signed in, on another device.
6. Recovery if something fails: inline error with retry; local data is never discarded on a sync failure.

## Secondary journeys
- Sign in once (Supabase) and stay signed in across Virtus, Dictum and Aurum (shared session on one origin).
- Switch theme in any app; the choice applies to every app (`essentia-theme`).
- Dictum: share a document and open the link at `/dictum/shared/<id>` while signed out.
- Aurum: recurring items post when the app syncs, catching up any missed periods.
- Virtus: install as a PWA and check in offline.

## Screen inventory
| Screen / route | User goal | Primary action | Key states | Responsive notes |
|---|---|---|---|---|
| Hub `/` | Pick an app | Open an app | Default | 640 px column; single column of app entries at 375 px |
| Acta `/acta/` | Manage tasks | Add task | Empty, list, filtered (none match), completed | 520 px column |
| Folio `/folio/` | Write and find notes | New note | Empty library, list, editor, search no results, save failed | Library, list and editor from 1024 px; list + editor from 768 px (library folds into a filter bar); one pane below 768 px |
| Virtus `/virtus/` | Track habits | Check in today | Empty, habits, streak milestone, offline | 520 px column |
| Virtus Streaks, Week, Stats views | See progress | Open a habit's stats | Not enough data | Charts reflow to one column at 375 |
| Dictum `/dictum/` | Write markdown | New document | Empty, editing, preview, version history, zen mode, sync error | Editor + preview from 1280 px; editor/preview toggle from 768 px; one pane below 768 px |
| Dictum shared `/dictum/shared/<id>` | Read a shared document | Read | Loading, not shared any more, couldn't load | Reading column |
| Aurum `/aurum/` signed out | Get access | Sign in / sign up | Validation, auth error, not set up (no Supabase project in this build) | 520 px column |
| Aurum Transactions | Track money | Add transaction | Empty, list, filtered, loading, sync error | 520 px column |
| Aurum Insights, Plan (budgets, recurring items, CSV export and import) | Plan and review | Set budget / add recurring | Empty, over budget, paused item, import errors | Charts reflow at 375 |

## Interactions
| Interaction | Expected behavior | Keyboard / a11y | Failure and recovery |
|---|---|---|---|
| Add item (any app) | Appears at once, input clears and keeps focus | Enter submits; labelled input | Inline validation; nothing lost |
| Delete item | Removed at once with an Undo notice (Acta, Folio, Virtus, Dictum, Aurum); in Folio, Undo reopens the note | Undo notice is a status region, so the deletion is announced | Save failure shown as an alert; the change lasts until the page closes |
| Theme toggle | Switches all apps | Button with pressed state | Falls back to system preference |
| Sign in | One form, session shared across apps | Labelled fields, errors announced | Plain error, retry; local mode still usable (except Aurum) |
| Sync | Background; status in the account dialog | Status text, not only colour | Notice with Try again on the page; local copy kept |
| Share (Dictum) | Generates link, copy button, stop sharing | Copy confirmed in a status region | Error with retry; if copying fails the link is selected for Ctrl+C |

## Empty, error, and no-permission content
- Empty: a serif one-liner ("Nothing on the list."), one muted sentence, and the primary action.
- Error: what happened and what to do ("Couldn’t sync with your account. Your changes are kept on this device.", with Try again beside it).
- No permission / not found: Dictum shared links that are revoked show "This document isn’t shared any more." with a link to the hub. Any other unknown path outside Dictum shows the suite's 404 page, "Nothing lives at this address.", with a link to the hub.

## UX checks for every UI change
- [ ] The primary journey can be completed without guessing.
- [ ] Actions give clear feedback.
- [ ] Errors explain how to recover.
- [ ] Focus order and keyboard behavior are coherent.
- [ ] Layouts keep task priority across widths.
