import type { Note, NoteVersion } from '../domain/notes'

/** Downloads every note and version as one JSON file, a copy that does not depend on this device's storage. */
export function exportAll(notes: Note[], versions: NoteVersion[], now = new Date()) {
  const text = JSON.stringify({ exportedAt: now.toISOString(), notes, versions }, null, 2)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `folio-notes-${now.toISOString().slice(0, 10)}.json`
  link.click()
  // Some browsers cancel a download whose URL is revoked in the same task.
  setTimeout(() => URL.revokeObjectURL(url))
}
