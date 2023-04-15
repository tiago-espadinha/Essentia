// Merging this device's notes and folders with the account's copy in Supabase
// (supabase/migration.sql). Each note carries the time it last changed; the
// newer side wins whole, format included, and the merge lists what the server
// is missing or has older. Versions stay on the device.
import { isUuid } from '../domain/ids'
import { cleanFolder, FOLDER_LIMIT, parseTags, type Note, type NoteFormat } from '../domain/notes'
import { sanitizeHtml } from '../domain/sanitize'

/** What this device has to remember between syncs (`essentia-notes-sync`). */
export interface Stamps {
  /** The account these notes belong to, or null while they have never been synced. */
  owner: string | null
  /** Notes deleted here, and when, until the server has the deletion. */
  deleted: Record<string, string>
  /** Folders added or deleted here, and when, until the server has the change. Whether it was an addition is whether the folder is kept. */
  folders: Record<string, string>
}

export const NO_STAMPS: Stamps = { owner: null, deleted: {}, folders: {} }

export interface NoteRow {
  id: string
  format: NoteFormat
  title: string
  content: string
  folder: string
  tags: string[]
  pinned: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FolderRow {
  name: string
  updated_at: string
  deleted_at: string | null
}

export interface Push {
  notes: NoteRow[]
  deletions: { id: string; at: string }[]
  /** Folders to add, or to add again after a deletion. */
  folders: FolderRow[]
  folderDeletions: { name: string; at: string }[]
}

/** The tables' checks; a note past them stays on this device. HTML counts toward the content limit. */
export const LIMITS = { title: 300, content: 1_000_000, folder: FOLDER_LIMIT, tags: 50 }

/** Old non-UUID ids and oversized notes cannot be stored in the account. */
export const syncable = (note: Note) =>
  isUuid(note.id) &&
  note.title.length <= LIMITS.title &&
  note.body.length <= LIMITS.content &&
  note.folder.length <= LIMITS.folder &&
  note.tags.length <= LIMITS.tags

/** A folder name the account can hold: tidy, not blank, within the limit. */
const syncableFolder = (name: string) => name !== '' && name === cleanFolder(name) && name.length <= LIMITS.folder

const time = (stamp: string) => Date.parse(stamp)
const isStamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(time(value))
const isString = (value: unknown): value is string => typeof value === 'string'
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const iso = (stamp: string) => new Date(stamp).toISOString()

function isNoteRow(value: unknown): value is NoteRow {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isUuid(value.id) &&
    (value.format === 'rich' || value.format === 'markdown') &&
    isString(value.title) &&
    isString(value.content) &&
    isString(value.folder) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    typeof value.pinned === 'boolean' &&
    isStamp(value.created_at) &&
    isStamp(value.updated_at) &&
    (value.deleted_at === null || isStamp(value.deleted_at))
  )
}

function isFolderRow(value: unknown): value is FolderRow {
  return (
    isRecord(value) &&
    isString(value.name) &&
    syncableFolder(value.name) &&
    isStamp(value.updated_at) &&
    (value.deleted_at === null || isStamp(value.deleted_at))
  )
}

/**
 * Keeps the note rows the app can trust, tidied as saved data is: another
 * client wrote them, so rich bodies are sanitized again. The first row of an id wins.
 */
export function readRemote(rows: unknown[]): NoteRow[] {
  const seen = new Set<string>()
  return rows.filter(isNoteRow).flatMap((row) => {
    if (seen.has(row.id)) return []
    seen.add(row.id)
    return [
      {
        id: row.id,
        format: row.format,
        title: row.title,
        content: row.format === 'rich' ? sanitizeHtml(row.content) : row.content,
        folder: cleanFolder(row.folder),
        tags: parseTags(row.tags.join(',')),
        pinned: row.pinned,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      },
    ]
  })
}

/** Keeps the folder rows the app can trust; the first row of a name wins. */
export function readRemoteFolders(rows: unknown[]): FolderRow[] {
  const seen = new Set<string>()
  return rows.filter(isFolderRow).flatMap(({ name, updated_at, deleted_at }) => {
    if (seen.has(name)) return []
    seen.add(name)
    return [{ name, updated_at, deleted_at }]
  })
}

/** Stamps the notes a change removed; a note put back (undo) drops its stamp. */
export function stampDeletions(before: Note[], after: Note[], stamps: Stamps, at: string): Stamps {
  const kept = new Set(after.map((note) => note.id))
  const deleted = new Map(Object.entries(stamps.deleted))
  for (const note of before) if (!kept.has(note.id)) deleted.set(note.id, at)
  for (const id of kept) deleted.delete(id)
  return { ...stamps, deleted: Object.fromEntries(deleted) }
}

/** Stamps the folders a change added or removed; the server learns which from whether the folder is kept. */
export function stampFolders(before: string[], after: string[], stamps: Stamps, at: string): Stamps {
  const was = new Set(before)
  const now = new Set(after)
  const folders = new Map(Object.entries(stamps.folders))
  for (const name of was) if (!now.has(name)) folders.set(name, at)
  for (const name of now) if (!was.has(name)) folders.set(name, at)
  return { ...stamps, folders: Object.fromEntries(folders) }
}

const toRow = (note: Note): NoteRow => ({
  id: note.id,
  format: note.format,
  title: note.title,
  content: note.body,
  folder: note.folder,
  tags: note.tags,
  pinned: note.pinned,
  created_at: note.createdAt,
  updated_at: note.updatedAt,
  deleted_at: null,
})

const fromRow = (row: NoteRow): Note => ({
  id: row.id,
  format: row.format,
  title: row.title,
  body: row.content,
  folder: row.folder,
  tags: row.tags,
  pinned: row.pinned,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
})

/** Merges the account's note rows into this device's notes. */
export function mergeNotes(local: Note[], stamps: Stamps, remote: NoteRow[]) {
  const deleted = new Map(Object.entries(stamps.deleted))
  const push: Pick<Push, 'notes' | 'deletions'> = { notes: [], deletions: [] }
  const rows = new Map(remote.map((row) => [row.id, row]))
  const notes: Note[] = []

  for (const note of local) {
    const row = rows.get(note.id)
    rows.delete(note.id)
    if (!syncable(note)) notes.push(note)
    else if (!row || time(note.updatedAt) > time(row.updated_at)) {
      // Also brings back a note deleted elsewhere before this edit.
      push.notes.push(toRow(note))
      notes.push(note)
    } else if (!row.deleted_at) notes.push(time(note.updatedAt) === time(row.updated_at) ? note : fromRow(row))
    // Otherwise it was deleted elsewhere after this device last changed it.
  }

  // Deleted here: tell the server unless it has a newer version, which comes back.
  for (const [id, at] of deleted) {
    const row = rows.get(id)
    rows.delete(id)
    if (row && !row.deleted_at && time(at) > time(row.updated_at)) {
      // The stamp stays until a later sync sees the deletion on the server.
      push.deletions.push({ id, at })
      continue
    }
    deleted.delete(id)
    if (row && !row.deleted_at) notes.push(fromRow(row))
  }

  for (const row of rows.values()) if (!row.deleted_at) notes.push(fromRow(row))

  return { notes, stamps: { ...stamps, deleted: Object.fromEntries(deleted) }, push }
}

/**
 * Merges the account's folder rows into the folders kept on this device. A
 * change made here (a stamp) wins over an older one on the server; a folder
 * this device never changed follows the server, and `now` dates one the server
 * has never seen. When notes made while signed out join an account, stamp their
 * folders first (`stampFolders([], folders, …)`), so an old deletion of the same
 * name in the account does not remove them.
 */
export function mergeFolders(local: string[], stamps: Stamps, remote: FolderRow[], now: string) {
  const changed = new Map(Object.entries(stamps.folders))
  const push: Pick<Push, 'folders' | 'folderDeletions'> = { folders: [], folderDeletions: [] }
  const rows = new Map(remote.map((row) => [row.name, row]))
  const folders = new Set<string>()

  for (const name of new Set(local)) {
    const row = rows.get(name)
    rows.delete(name)
    const at = changed.get(name)
    if (!syncableFolder(name) || (row && !row.deleted_at)) {
      folders.add(name)
      changed.delete(name)
    } else if (!row || (at !== undefined && time(at) > time(row.updated_at))) {
      // New here, or added again after a deletion elsewhere; the stamp stays until the server has it.
      push.folders.push({ name, updated_at: at ?? now, deleted_at: null })
      folders.add(name)
    } else changed.delete(name)
    // Otherwise it was deleted elsewhere after this device last changed it.
  }

  // Deleted here: tell the server unless it kept the folder later, which comes back.
  for (const [name, at] of changed) {
    if (folders.has(name)) continue
    const row = rows.get(name)
    rows.delete(name)
    if (row && !row.deleted_at && time(at) > time(row.updated_at)) {
      push.folderDeletions.push({ name, at })
      continue
    }
    changed.delete(name)
    if (row && !row.deleted_at) folders.add(name)
  }

  for (const row of rows.values()) if (!row.deleted_at) folders.add(row.name)

  return { folders: [...folders], stamps: { ...stamps, folders: Object.fromEntries(changed) }, push }
}

/** Merges notes and folders in one pass, for one sync. */
export function merge(local: { notes: Note[]; folders: string[] }, stamps: Stamps, remote: { notes: NoteRow[]; folders: FolderRow[] }, now: string) {
  const notes = mergeNotes(local.notes, stamps, remote.notes)
  const folders = mergeFolders(local.folders, notes.stamps, remote.folders, now)
  return {
    notes: notes.notes,
    folders: folders.folders,
    stamps: folders.stamps,
    push: { ...notes.push, ...folders.push } satisfies Push,
  }
}
