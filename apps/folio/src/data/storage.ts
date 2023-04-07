import { cleanFolder, parseTags, type Note, type NoteVersion } from '../domain/notes'
import { sanitizeHtml } from '../domain/sanitize'

// The notes store, shared by everything Folio holds. The keys the apps used
// before it (see sources.ts) are only ever read.
export const NOTES_KEY = 'essentia-notes'
export const VERSIONS_KEY = 'essentia-notes-versions'
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
