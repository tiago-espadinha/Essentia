import { useEffect, useRef, useState } from 'react'
import { convert } from '../domain/convert'
import { applyChanges, createNote, type Note, type NoteChanges, type NoteVersion } from '../domain/notes'
import { addVersion } from '../domain/versions'
import { openNotes } from '../data/migrate'
import { loadNotes, loadVersions, NOTES_KEY, save, saveNotes, VERSIONS_KEY } from '../data/storage'

interface Store {
  notes: Note[]
  versions: NoteVersion[]
}

/** The notes and their versions, taken in from the old Folio and Dictum stores on load and saved to this device on every change. */
export function useNotes() {
  const [opened] = useState(openNotes)
  const [store, setStore] = useState<Store>({ notes: opened.notes, versions: opened.versions })
  const [saveFailed, setSaveFailed] = useState(false)
  // Several changes can land in one event (a conversion saves a version, then
  // the note), so each builds on the last one.
  const latest = useRef(store)
  // The versions of the latest deleted note, put back if it is restored.
  const removedVersions = useRef<NoteVersion[]>([])

  // Another tab can change the store, taking notes in or editing them: its list
  // replaces this one, so the next change here does not write over it.
  useEffect(() => {
    function reload(event: StorageEvent) {
      if (event.key !== NOTES_KEY && event.key !== VERSIONS_KEY && event.key !== null) return
      const notes = loadNotes()
      latest.current = { notes, versions: loadVersions(notes.map((note) => note.id)) }
      setStore(latest.current)
    }
    window.addEventListener('storage', reload)
    return () => window.removeEventListener('storage', reload)
  }, [])

  /** Applies the change and stores it; false when it could not be stored on this device. */
  function commit(change: (current: Store) => Store): boolean {
    // Notes that could not be stored stay as they are, so a later load can still take them in.
    if (opened.failed) return false
    const current = latest.current
    const next = change(current)
    const notesSaved = next.notes === current.notes || saveNotes(next.notes)
    const versionsSaved = next.versions === current.versions || save(VERSIONS_KEY, next.versions)
    // Notes that could not be stored are kept until the page closes; versions are not, so a
    // version is never taken as saved first (before a conversion, say) when it only lives here.
    const kept = versionsSaved ? next : { ...next, versions: current.versions }
    latest.current = kept
    setStore(kept)
    setSaveFailed(!notesSaved || !versionsSaved)
    return notesSaved && versionsSaved
  }

  const updateNote = (id: string, changes: NoteChanges) =>
    commit((current) => ({ ...current, notes: current.notes.map((note) => (note.id === id ? applyChanges(note, changes) : note)) }))

  const saveVersion = (id: string) =>
    commit((current) => {
      const note = current.notes.find((n) => n.id === id)
      return note ? { ...current, versions: addVersion(current.versions, note) } : current
    })

  return {
    notes: store.notes,
    versions: store.versions,
    /** True when the notes could not be stored on this device; they are shown but not changed. */
    readOnly: opened.failed,
    saveFailed,
    /** Adds a blank note at the top and returns it. */
    add: () => {
      const note = createNote()
      commit((current) => ({ ...current, notes: [note, ...current.notes] }))
      return note
    },
    update: updateNote,
    saveVersion,
    /** Saves the note as it is first, so the restore can itself be undone; without that version stored, nothing changes. */
    restoreVersion: (id: string, version: NoteVersion) => {
      if (!saveVersion(id)) return
      updateNote(id, { title: version.title, body: version.body, format: version.format })
    },
    /** Saves the note as it is first, so the conversion is undone by restoring that version; without it stored, nothing changes. */
    convert: (id: string) => {
      const note = latest.current.notes.find((n) => n.id === id)
      if (!note || !saveVersion(id)) return
      const { format, body } = convert(note)
      updateNote(id, { format, body })
    },
    /** Removes the note and its versions; the versions come back with an undo. */
    remove: (id: string) =>
      commit((current) => {
        removedVersions.current = current.versions.filter((version) => version.noteId === id)
        return {
          notes: current.notes.filter((note) => note.id !== id),
          versions: current.versions.filter((version) => version.noteId !== id),
        }
      }),
    /** Puts a deleted note back as it was; the list orders it by its own dates. */
    restore: (note: Note) =>
      commit((current) => ({
        notes: [note, ...current.notes],
        versions: [...removedVersions.current.filter((version) => version.noteId === note.id), ...current.versions],
      })),
  }
}
