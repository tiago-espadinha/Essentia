// Saved earlier states of a note, kept on this device only.
import { newId, type Note, type NoteVersion } from './notes'

/** Versions kept per note; past it the oldest go. */
export const MAX_VERSIONS = 20

/** Newest first. */
export function versionsOf(versions: NoteVersion[], noteId: string): NoteVersion[] {
  return versions.filter((version) => version.noteId === noteId).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Whether a version holds exactly what the note holds now. */
export function holds(version: NoteVersion | undefined, note: Note): boolean {
  return version !== undefined && version.title === note.title && version.body === note.body && version.format === note.format
}

/**
 * Saves the note as it is now, unless its newest version already holds the same
 * title, body and format. Keeps the newest MAX_VERSIONS for that note.
 */
export function addVersion(versions: NoteVersion[], note: Note, now: Date = new Date(), id: string = newId()): NoteVersion[] {
  const own = versionsOf(versions, note.id)
  if (holds(own[0], note)) return versions
  const version = { id, noteId: note.id, title: note.title, body: note.body, format: note.format, savedAt: now.toISOString() }
  const kept = new Set([version, ...own].slice(0, MAX_VERSIONS))
  return [version, ...versions].filter((v) => v.noteId !== note.id || kept.has(v))
}
