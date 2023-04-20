import { isUuid, uuidFromHash } from '../domain/ids'
import type { Note, NoteVersion } from '../domain/notes'
import { dictumOwner, readDictum, readDictumDeleted, readDictumVersions, readFolio } from './sources'
import {
  cleanNote,
  isRecord,
  isString,
  isTimestamp,
  loadNotes,
  loadStamps,
  loadVersions,
  NOTES_KEY,
  readList,
  readRaw,
  save,
  saveStamps,
  UNREADABLE_KEY,
  VERSIONS_KEY,
} from './storage'

export const LEDGER_KEY = 'essentia-notes-migration'

interface Imported {
  /** The note's id in the notes store. */
  id: string
  /** The source's updatedAt when it was last taken in. */
  sourceUpdatedAt: string
  /** The id of the "earlier copy" made when both sides had changed. */
  conflictCopy?: string
}

/** What has been taken in from the old stores, keyed `folio:<id>` or `dictum:<id>`. */
export interface Ledger {
  schema: 1
  imported: Record<string, Imported>
  /** Dictum documents now kept by Folio; Dictum reads this to hide them. */
  moved: string[]
  /** Accounts whose Dictum copy Folio has taken over; Dictum stops syncing them. Missing before T-052b. */
  accounts?: string[]
  skipped: { folio: number; dictum: number }
  lastRun: string
}

export interface Store {
  notes: Note[]
  versions: NoteVersion[]
}

export interface Sources {
  folio: Note[]
  /** Dictum documents made while signed out, or the account's copy when the notes belong to the same account. */
  dictum: Note[]
  dictumVersions: NoteVersion[]
  /**
   * Set when `dictum` is that account's copy: its id, the deletions it has not
   * synced yet, and the notes deleted here that the account has not heard of.
   */
  account?: { id: string; deleted: Record<string, string>; removedHere: string[] }
  skipped: Ledger['skipped']
}

function isImported(value: unknown): value is Imported {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isTimestamp(value.sourceUpdatedAt) &&
    (value.conflictCopy === undefined || isString(value.conflictCopy))
  )
}

function loadLedger(): Ledger | null {
  try {
    const saved: unknown = JSON.parse(readRaw(LEDGER_KEY) ?? 'null')
    if (!isRecord(saved) || saved.schema !== 1 || !isRecord(saved.imported) || !Array.isArray(saved.moved)) return null
    if (!Object.values(saved.imported).every(isImported) || !saved.moved.every(isString)) return null
    if (saved.accounts !== undefined && !(Array.isArray(saved.accounts) && saved.accounts.every(isString))) return null
    return saved as unknown as Ledger
  } catch {
    return null
  }
}

const newer = (a: string, b: string) => Date.parse(a) > Date.parse(b)

/**
 * Adds what the old stores hold to the notes store, the same way every run:
 * ids are kept or derived from a hash, so a note is never taken in twice, even
 * without a ledger. A source changed after it was taken in replaces the note
 * if the note has not changed since, or else comes in as an "earlier copy".
 * Nothing is ever overwritten that was edited here.
 */
export function mergeSources(
  store: Store,
  ledger: Ledger | null,
  sources: Sources,
  now: string,
): Store & { ledger: Ledger; deleted: Record<string, string> } {
  const notes = [...store.notes]
  const at = new Map(notes.map((note, index) => [note.id, index]))
  const imported = { ...ledger?.imported }
  const moved = new Set(ledger?.moved)
  const dictumIds = new Set(sources.dictum.map((note) => note.id))
  // Which source each id in the store was taken in from, so one source never lands on another's note.
  const owners = new Map<string, string>()
  for (const [key, entry] of Object.entries(imported)) {
    owners.set(entry.id, key)
    if (entry.conflictCopy) owners.set(entry.conflictCopy, key)
  }
  const takenByOther = (id: string, key: string) => owners.has(id) && owners.get(id) !== key
  let collisions = 0
  const removedHere = new Set(sources.account?.removedHere)

  function add(note: Note) {
    if (at.has(note.id)) return
    at.set(note.id, notes.length)
    notes.push(note)
  }

  function record(key: string, entry: Imported) {
    imported[key] = entry
    owners.set(entry.id, key)
    if (entry.conflictCopy) owners.set(entry.conflictCopy, key)
  }

  /** Both sides changed: the source comes in beside the note as an "earlier copy". */
  function keepBoth(key: string, id: string, source: Note) {
    const copy = uuidFromHash(`conflict:${key}:${source.updatedAt}`)
    add({ ...source, id: copy, title: `${source.title} (earlier copy)`.trim() })
    record(key, { id, sourceUpdatedAt: source.updatedAt, conflictCopy: copy })
  }

  function take(key: string, source: Note) {
    const entry = imported[key]
    if (!entry) {
      const index = at.get(source.id)
      // Already here without a ledger entry (the ledger was lost): kept as is, and a different source beside it.
      if (index !== undefined && notes[index].updatedAt !== source.updatedAt) return keepBoth(key, source.id, source)
      add(source)
      return record(key, { id: source.id, sourceUpdatedAt: source.updatedAt })
    }
    if (!newer(source.updatedAt, entry.sourceUpdatedAt)) return
    const index = at.get(entry.id)
    if (index !== undefined && notes[index].updatedAt === entry.sourceUpdatedAt) {
      notes[index] = { ...source, id: entry.id }
      return record(key, { ...entry, sourceUpdatedAt: source.updatedAt })
    }
    keepBoth(key, entry.id, source)
  }

  /**
   * A document of the account the notes belong to: both copies mirror the same
   * row, so the newer one wins whole, as a sync would, with no earlier copy.
   */
  function mirror(key: string, source: Note) {
    const entry = imported[key]
    if (entry && !newer(source.updatedAt, entry.sourceUpdatedAt)) return
    const id = entry?.id ?? source.id
    const index = at.get(id)
    if (index === undefined) {
      // Deleted here and not yet synced: the deletion stands.
      if (!removedHere.has(id)) add({ ...source, id })
    } else if (newer(source.updatedAt, notes[index].updatedAt)) notes[index] = { ...source, id }
    record(key, { id, sourceUpdatedAt: source.updatedAt })
  }

  for (const note of sources.folio) {
    const key = `folio:${note.id}`
    const own = isUuid(note.id) && !dictumIds.has(note.id) && !takenByOther(note.id, key)
    const id = imported[key]?.id ?? (own ? note.id : uuidFromHash(`essentia-folio:${note.id}`))
    take(key, cleanNote({ ...note, id }))
  }
  const taken = new Set<string>()
  for (const note of sources.dictum) {
    const key = `dictum:${note.id}`
    // Dictum's ids are kept for its links, so a document whose id another note holds stays in Dictum.
    if (takenByOther(note.id, key)) {
      collisions++
      continue
    }
    if (sources.account) mirror(key, cleanNote(note))
    else take(key, cleanNote(note))
    moved.add(note.id)
    taken.add(note.id)
  }

  // An account's pending deletions go with its documents, so the account still hears of them;
  // each once, as a moved id, so a deletion synced since is not stamped again.
  // A note edited here after the deletion outranks it, so that deletion is not carried.
  const deleted: Record<string, string> = {}
  const dropped = new Set<string>()
  for (const [id, stamp] of Object.entries(sources.account?.deleted ?? {})) {
    if (moved.has(id) || takenByOther(id, `dictum:${id}`)) continue
    moved.add(id)
    const index = at.get(id)
    if (index !== undefined && !newer(stamp, notes[index].updatedAt)) continue
    if (index !== undefined) dropped.add(id)
    deleted[id] = stamp
  }
  const accounts = new Set(ledger?.accounts)
  if (sources.account) accounts.add(sources.account.id)

  const versionIds = new Set(store.versions.map((version) => version.id))
  const versions = [
    ...store.versions,
    ...sources.dictumVersions.filter((version) => !versionIds.has(version.id) && taken.has(version.noteId) && at.has(version.noteId)),
  ]

  return {
    notes: dropped.size > 0 ? notes.filter((note) => !dropped.has(note.id)) : notes,
    versions: dropped.size > 0 ? versions.filter((version) => !dropped.has(version.noteId)) : versions,
    ledger: {
      schema: 1,
      imported,
      moved: [...moved],
      ...(accounts.size > 0 && { accounts: [...accounts] }),
      skipped: { ...sources.skipped, dictum: sources.skipped.dictum + collisions },
      lastRun: now,
    },
    deleted,
  }
}

export interface Opened extends Store {
  /** True when the notes could not be stored here: they show read-only, and the next load tries again. */
  failed: boolean
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Keeps an unreadable notes list before anything is written over it. An earlier,
 * different copy is never replaced: the next one is keyed by its content, so the
 * same value is kept once however often loading fails.
 */
function keepUnreadable(raw: string): boolean {
  const kept = readRaw(UNREADABLE_KEY)
  const key = kept === null ? UNREADABLE_KEY : `${UNREADABLE_KEY}:${uuidFromHash(raw)}`
  return readRaw(key) === JSON.stringify(raw) || save(key, raw)
}

/**
 * Reads the notes store and takes in the old stores, writing notes, then
 * versions, then the ledger last, each only when it changed. A refused or
 * unconfirmed write of notes or versions stops the rest and reports failure.
 * `session` is the account signed in on this device, when known: an account's
 * Dictum copy is only taken in while that account is the one signed in.
 */
export function openNotes(now = new Date().toISOString(), session?: string | null): Opened {
  const store = { notes: loadNotes(), versions: [] as NoteVersion[] }
  store.versions = loadVersions(store.notes.map((note) => note.id))
  const ledger = loadLedger()
  const folio = readFolio()
  const stamps = loadStamps()
  // Dictum's copy joins notes with the same owner: signed-out documents join signed-out notes
  // (and so the claim dialog), an account's copy joins that account's notes while it is signed in.
  // Any other copy waits, untouched, for its own sign-out or claim.
  const owner = dictumOwner()
  const readable = owner === stamps.owner && (owner === null || session === undefined || session === owner)
  const dictum = readable ? readDictum() : { notes: [], skipped: 0 }
  const next = mergeSources(store, ledger, {
    folio: folio.notes,
    dictum: dictum.notes,
    dictumVersions: readable ? readDictumVersions() : [],
    skipped: { folio: folio.skipped, dictum: dictum.skipped },
    ...(owner !== null && readable && { account: { id: owner, deleted: readDictumDeleted(), removedHere: Object.keys(stamps.deleted) } }),
  }, now)
  const result = { notes: next.notes, versions: next.versions }

  // Before any write, here or by the first edit: an unreadable list can be one that only failed to parse.
  const raw = readRaw(NOTES_KEY)
  if (raw !== null && !readList(NOTES_KEY).readable && !keepUnreadable(raw)) return { ...result, failed: true }
  if (!same(next.notes, store.notes)) {
    if (!save(NOTES_KEY, next.notes) || !same(loadNotes().map((note) => note.id), next.notes.map((note) => note.id))) {
      return { ...result, failed: true }
    }
  }
  // Against what is stored, not what was loaded: versions of deleted notes are dropped on load and must go here too.
  const versionsChanged = !same(next.versions, readList(VERSIONS_KEY).items)
  if (versionsChanged && !save(VERSIONS_KEY, next.versions)) return { ...result, failed: true }
  // Before the ledger marks them moved: a deletion not stamped here would be lost.
  if (Object.keys(next.deleted).length > 0 && !saveStamps({ ...stamps, deleted: { ...next.deleted, ...stamps.deleted } })) {
    return { ...result, failed: true }
  }
  const ledgerChanged = !ledger || !same({ ...ledger, lastRun: '' }, { ...next.ledger, lastRun: '' })
  // Without the ledger Dictum keeps showing what was just taken in, so edits there would split the note.
  // With nothing taken in, a refused ledger loses nothing: a browser that stores nothing still opens for editing.
  const tookIn =
    !same(ledger?.imported ?? {}, next.ledger.imported) ||
    !same(ledger?.moved ?? [], next.ledger.moved) ||
    !same(ledger?.accounts ?? [], next.ledger.accounts ?? [])
  if (ledgerChanged && !save(LEDGER_KEY, next.ledger) && tookIn) return { ...result, failed: true }
  return { ...result, failed: false }
}
