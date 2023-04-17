import { cleanFolder, FOLDER_LIMIT, parseTags, type Note, type NoteVersion } from '../domain/notes'
import { sanitizeHtml } from '../domain/sanitize'
import { NO_STAMPS, type Stamps } from './sync'

// The notes store, shared by everything Folio holds. The keys the apps used
// before it (see sources.ts) are only ever read.
export const NOTES_KEY = 'essentia-notes'
export const VERSIONS_KEY = 'essentia-notes-versions'
/** Folders kept on their own, so a folder stays while it holds no notes. */
export const FOLDERS_KEY = 'essentia-notes-folders'
/** Which account the notes belong to, and the deletions and folder changes not yet synced. */
export const SYNC_KEY = 'essentia-notes-sync'
/**
 * Notes, versions and folders set aside with "Keep on this device only". Not an
 * account's, so signing out keeps them; they come back once no account owns the notes.
 */
export const DEVICE_KEY = 'essentia-notes-device'
/** A copy of an unreadable notes list, kept before anything is written over it. */
export const UNREADABLE_KEY = 'essentia-notes-unreadable'

export const isString = (value: unknown): value is string => typeof value === 'string'
export const isTimestamp = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isFormat = (value: unknown): value is Note['format'] => value === 'rich' || value === 'markdown'

/** The raw value under a key, or null when there is none or storage is unreadable. */
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The entries of a stored list; `readable` is false when something is stored but it is not a JSON list. */
export function readList(key: string): { items: unknown[]; readable: boolean } {
  const raw = readRaw(key)
  if (raw === null) return { items: [], readable: true }
  try {
    const saved: unknown = JSON.parse(raw)
    return Array.isArray(saved) ? { items: saved, readable: true } : { items: [], readable: false }
  } catch {
    return { items: [], readable: false }
  }
}

/** Keeps the first entry of each id. */
export function unique<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item)
  return [...byId.values()]
}

function isNote(value: unknown): value is Note {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isFormat(value.format) &&
    isString(value.title) &&
    isString(value.body) &&
    isString(value.folder) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    typeof value.pinned === 'boolean' &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

function isVersion(value: unknown): value is NoteVersion {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.noteId) &&
    isString(value.title) &&
    isString(value.body) &&
    isFormat(value.format) &&
    isTimestamp(value.savedAt)
  )
}

/** A note in its stored shape, with saved data not trusted: rich bodies are sanitized again. */
export function cleanNote({ id, format, title, body, folder, tags, pinned, createdAt, updatedAt }: Note): Note {
  return {
    id,
    format,
    title,
    body: format === 'rich' ? sanitizeHtml(body) : body,
    folder: cleanFolder(folder),
    tags: parseTags(tags.join(',')),
    pinned,
    createdAt,
    updatedAt,
  }
}

/** Reads the saved notes. Anything malformed or repeated is skipped. */
export function loadNotes(): Note[] {
  return unique(readList(NOTES_KEY).items.filter(isNote)).map(cleanNote)
}

/** Reads the saved versions of the given notes; versions of notes that are gone are dropped. */
export function loadVersions(noteIds: string[]): NoteVersion[] {
  const known = new Set(noteIds)
  return unique(readList(VERSIONS_KEY).items.filter(isVersion))
    .filter((version) => known.has(version.noteId))
    .map(({ id, noteId, title, body, format, savedAt }) => ({
      id,
      noteId,
      title,
      body: format === 'rich' ? sanitizeHtml(body) : body,
      format,
      savedAt,
    }))
}

/** Returns false when the browser refuses to store the value (private mode, quota). */
export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const saveNotes = (notes: Note[]) => save(NOTES_KEY, notes)

/**
 * Reads the folders kept on their own: names cleaned, blank, overlong and
 * repeated ones skipped. Anything unreadable reads as none, and is left as it
 * is until a folder change writes the list again.
 */
export function loadFolders(): string[] {
  const names = readList(FOLDERS_KEY).items.filter(isString).map(cleanFolder)
  return [...new Set(names.filter((name) => name && name.length <= FOLDER_LIMIT))]
}

export const saveFolders = (folders: string[]) => save(FOLDERS_KEY, folders)

const isStampMap = (value: unknown): value is Record<string, string> =>
  isRecord(value) && !Array.isArray(value) && Object.values(value).every(isTimestamp)

/**
 * Reads which account the notes belong to and the changes not yet synced.
 * Unreadable stamps start over, as in Dictum: the notes then count as never
 * synced, so they join an account only through the claim dialog.
 */
export function loadStamps(): Stamps {
  try {
    const saved: unknown = JSON.parse(readRaw(SYNC_KEY) ?? 'null')
    if (!isRecord(saved) || !(saved.owner === null || isString(saved.owner)) || !isStampMap(saved.deleted)) return NO_STAMPS
    // Stamps from before folders synced have none.
    const folders = saved.folders === undefined ? {} : isStampMap(saved.folders) ? saved.folders : null
    return folders ? { owner: saved.owner, deleted: { ...saved.deleted }, folders: { ...folders } } : NO_STAMPS
  } catch {
    return NO_STAMPS
  }
}

export const saveStamps = (stamps: Stamps) => save(SYNC_KEY, stamps)

/** What the device keeps apart from an account. */
export interface Kept {
  notes: Note[]
  versions: NoteVersion[]
  folders: string[]
}

export const NOTHING_KEPT: Kept = { notes: [], versions: [], folders: [] }

/** Reads what was set aside; anything malformed is skipped, and an unreadable value reads as nothing. */
export function loadKept(): Kept {
  try {
    const saved: unknown = JSON.parse(readRaw(DEVICE_KEY) ?? 'null')
    if (!isRecord(saved)) return NOTHING_KEPT
    const notes = unique(Array.isArray(saved.notes) ? saved.notes.filter(isNote) : []).map(cleanNote)
    const ids = new Set(notes.map((note) => note.id))
    const versions = unique(Array.isArray(saved.versions) ? saved.versions.filter(isVersion) : [])
      .filter((version) => ids.has(version.noteId))
      .map((version) => ({ ...version, body: version.format === 'rich' ? sanitizeHtml(version.body) : version.body }))
    const names = Array.isArray(saved.folders) ? saved.folders.filter(isString).map(cleanFolder) : []
    return { notes, versions, folders: [...new Set(names.filter((name) => name && name.length <= FOLDER_LIMIT))] }
  } catch {
    return NOTHING_KEPT
  }
}

/** Both sets together; where both hold an id, the first wins. */
export function joinKept(first: Kept, second: Kept): Kept {
  return {
    notes: unique([...first.notes, ...second.notes]),
    versions: unique([...first.versions, ...second.versions]),
    folders: [...new Set([...first.folders, ...second.folders])],
  }
}

/**
 * Adds to what is already set aside, the newer copy of a note winning; false
 * when it could not be stored, and then nothing is set aside.
 */
export const setAside = (kept: Kept) => save(DEVICE_KEY, joinKept(kept, loadKept()))

/** Forgets what was set aside, once it is back in the notes store. */
export function clearKept(): void {
  try {
    localStorage.removeItem(DEVICE_KEY)
  } catch {
    // Blocked storage: it is set aside still, and comes back again (ids keep it from doubling).
  }
}
