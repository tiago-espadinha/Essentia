import { isUuid, uuidFromHash } from '../domain/ids'
import type { Note, NoteVersion } from '../domain/notes'
import { dictumOwned, readDictum, readDictumVersions, readFolio } from './sources'
import {
  cleanNote,
  isRecord,
  isString,
  isTimestamp,
  loadNotes,
  loadVersions,
  NOTES_KEY,
  readList,
  readRaw,
  save,
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
  skipped: { folio: number; dictum: number }
  lastRun: string
}

export interface Store {
  notes: Note[]
  versions: NoteVersion[]
}

export interface Sources {
  folio: Note[]
  /** Only Dictum documents made while signed out; an account's copy waits for sync. */
  dictum: Note[]
  dictumVersions: NoteVersion[]
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
export function mergeSources(store: Store, ledger: Ledger | null, sources: Sources, now: string): Store & { ledger: Ledger } {
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
    take(key, cleanNote(note))
    moved.add(note.id)
    taken.add(note.id)
  }

  const versionIds = new Set(store.versions.map((version) => version.id))
  const versions = [
    ...store.versions,
    ...sources.dictumVersions.filter((version) => !versionIds.has(version.id) && taken.has(version.noteId) && at.has(version.noteId)),
  ]

  return {
    notes,
    versions,
    ledger: {
      schema: 1,
      imported,
      moved: [...moved],
      skipped: { ...sources.skipped, dictum: sources.skipped.dictum + collisions },
      lastRun: now,
    },
  }
}

export interface Opened extends Store {
  /** True when the notes could not be stored here: they show read-only, and the next load tries again. */
  failed: boolean
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Keeps an unreadable notes list before it is written over; an earlier, different copy is never replaced. */
function keepUnreadable(raw: string, now: string): boolean {
  const kept = readRaw(UNREADABLE_KEY)
  if (kept === JSON.stringify(raw)) return true
  return save(kept === null ? UNREADABLE_KEY : `${UNREADABLE_KEY}:${now}`, raw)
}

/**
 * Reads the notes store and takes in the old stores, writing notes, then
 * versions, then the ledger last, each only when it changed. A refused or
 * unconfirmed write stops the rest, so no step is half done.
 */
export function openNotes(now = new Date().toISOString()): Opened {
  const store = { notes: loadNotes(), versions: [] as NoteVersion[] }
  store.versions = loadVersions(store.notes.map((note) => note.id))
  const ledger = loadLedger()
  const folio = readFolio()
  const owned = dictumOwned()
  const dictum = owned ? { notes: [], skipped: 0 } : readDictum()
  const next = mergeSources(store, ledger, {
    folio: folio.notes,
    dictum: dictum.notes,
    dictumVersions: owned ? [] : readDictumVersions(),
    skipped: { folio: folio.skipped, dictum: dictum.skipped },
  }, now)
  const result = { notes: next.notes, versions: next.versions }

  if (!same(next.notes, store.notes)) {
    const raw = readRaw(NOTES_KEY)
    if (raw !== null && !readList(NOTES_KEY).readable && !keepUnreadable(raw, now)) return { ...result, failed: true }
    if (!save(NOTES_KEY, next.notes) || !same(loadNotes().map((note) => note.id), next.notes.map((note) => note.id))) {
      return { ...result, failed: true }
    }
  }
  // Against what is stored, not what was loaded: versions of deleted notes are dropped on load and must go here too.
  const versionsChanged = !same(next.versions, readList(VERSIONS_KEY).items)
  if (versionsChanged && !save(VERSIONS_KEY, next.versions)) return { ...result, failed: true }
  const ledgerChanged = !ledger || !same({ ...ledger, lastRun: '' }, { ...next.ledger, lastRun: '' })
  if (ledgerChanged && !save(LEDGER_KEY, next.ledger)) return { ...result, failed: true }
  return { ...result, failed: false }
}
