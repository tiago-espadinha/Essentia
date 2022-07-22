import { parseTags, type Note } from './notes'
import { sanitizeHtml } from './sanitize'

export const STORAGE_KEY = 'essentia-folio-notes'

const isString = (value: unknown): value is string => typeof value === 'string'
const isTimestamp = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false
  const note = value as Record<string, unknown>
  return (
    isString(note.id) &&
    isString(note.title) &&
    isString(note.body) &&
    Array.isArray(note.tags) &&
    note.tags.every(isString) &&
    typeof note.pinned === 'boolean' &&
    isTimestamp(note.createdAt) &&
    isTimestamp(note.updatedAt)
  )
}

/**
 * Reads the saved notes. Anything unreadable, malformed or repeated is skipped,
 * and every body is sanitized again: saved data is not trusted.
 */
export function loadNotes(): Note[] {
  let saved: unknown
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(saved)) return []

  const seen = new Set<string>()
  return saved.filter(isNote).flatMap(({ id, title, body, tags, pinned, createdAt, updatedAt }) => {
    if (seen.has(id)) return []
    seen.add(id)
    return [{ id, title, body: sanitizeHtml(body), tags: parseTags(tags.join(',')), pinned, createdAt, updatedAt }]
  })
}

/** Returns false when the browser refuses to store the notes (private mode, quota). */
export function saveNotes(notes: Note[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    return true
  } catch {
    return false
  }
}
