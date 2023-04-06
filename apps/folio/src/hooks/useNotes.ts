import { useEffect, useRef, useState } from 'react'
import { applyChanges, createNote, type Note, type NoteChanges } from '../domain/notes'
import { openNotes } from '../data/migrate'
import { loadNotes, NOTES_KEY, saveNotes } from '../data/storage'

/** The notes, taken in from the old Folio and Dictum stores on load and saved to this device on every change. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => openNotes().notes)
  const [saveFailed, setSaveFailed] = useState(false)
  // Several changes can land in one event (leaving the tags field for the
  // toolbar saves the tags, then the body), so each builds on the last one.
  const latest = useRef(notes)

  // Another tab can change the store, taking notes in or editing them: its list
  // replaces this one, so the next change here does not write over it.
  useEffect(() => {
    function reload(event: StorageEvent) {
      if (event.key !== NOTES_KEY && event.key !== null) return
      latest.current = loadNotes()
      setNotes(latest.current)
    }
    window.addEventListener('storage', reload)
    return () => window.removeEventListener('storage', reload)
  }, [])

  function commit(change: (current: Note[]) => Note[]) {
    const next = change(latest.current)
    latest.current = next
    setNotes(next)
    setSaveFailed(!saveNotes(next))
  }

  return {
    notes,
    saveFailed,
    /** Adds a blank note at the top and returns it. */
    add: () => {
      const note = createNote()
      commit((current) => [note, ...current])
      return note
    },
    update: (id: string, changes: NoteChanges) =>
      commit((current) => current.map((note) => (note.id === id ? applyChanges(note, changes) : note))),
    remove: (id: string) => commit((current) => current.filter((note) => note.id !== id)),
    /** Puts a deleted note back as it was; the list orders it by its own dates. */
    restore: (note: Note) => commit((current) => [note, ...current]),
  }
}
