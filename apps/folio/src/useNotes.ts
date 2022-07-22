import { useRef, useState } from 'react'
import { applyChanges, createNote, type Note, type NoteChanges } from './notes'
import { loadNotes, saveNotes } from './storage'

/** The notes, saved to this device on every change. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [saveFailed, setSaveFailed] = useState(false)
  // Several changes can land in one event (leaving the tags field for the
  // toolbar saves the tags, then the body), so each builds on the last one.
  const latest = useRef(notes)

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
  }
}
