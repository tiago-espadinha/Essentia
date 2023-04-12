import { useEffect, useRef, useState } from 'react'
import { convert } from '../domain/convert'
import { applyChanges, createNote, foldersOf, refileNotes, type Note, type NoteChanges, type NoteVersion } from '../domain/notes'
import { addVersion } from '../domain/versions'
import { openNotes } from '../data/migrate'
import { FOLDERS_KEY, loadFolders, loadNotes, loadVersions, NOTES_KEY, save, saveFolders, saveNotes, VERSIONS_KEY } from '../data/storage'

interface Store {
  notes: Note[]
  versions: NoteVersion[]
  /** Folders kept on their own; notes can be in others too (see `foldersOf`). */
  folders: string[]
}

/** The notes, their versions and folders, taken in from the old Folio and Dictum stores on load and saved to this device on every change. */
export function useNotes() {
  const [opened] = useState(openNotes)
  const [store, setStore] = useState<Store>(() => ({ notes: opened.notes, versions: opened.versions, folders: loadFolders() }))
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
      if (event.key !== NOTES_KEY && event.key !== VERSIONS_KEY && event.key !== FOLDERS_KEY && event.key !== null) return
      const notes = loadNotes()
      latest.current = { notes, versions: loadVersions(notes.map((note) => note.id)), folders: loadFolders() }
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
    const foldersSaved = next.folders === current.folders || saveFolders(next.folders)
    // Notes that could not be stored are kept until the page closes; versions are not, so a
    // version is never taken as saved first (before a conversion, say) when it only lives here.
    const kept = versionsSaved ? next : { ...next, versions: current.versions }
    latest.current = kept
    setStore(kept)
    setSaveFailed(!notesSaved || !versionsSaved || !foldersSaved)
    return notesSaved && versionsSaved && foldersSaved
  }

  /**
   * A folder change: the notes as `refile` leaves them, and every folder kept
   * from then on, so a folder stays once its last note leaves. `renamed` swaps
   * or (to null) drops one name; `added` keeps a new one.
   */
  const changeFolders = (refile: (notes: Note[]) => Note[], { renamed, added }: { renamed?: [string, string | null]; added?: string } = {}) =>
    commit((current) => {
      const notes = refile(current.notes)
      let folders = foldersOf(current.notes, current.folders)
      if (renamed) folders = folders.flatMap((folder) => (folder !== renamed[0] ? [folder] : renamed[1] ? [renamed[1]] : []))
      if (added) folders.push(added)
      return { ...current, notes, folders: foldersOf(notes, folders) }
    })

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
    /** Every folder, sorted: the ones kept on their own and the ones notes are in. */
    folders: foldersOf(store.notes, store.folders),
    /** True when the notes could not be stored on this device; they are shown but not changed. */
    readOnly: opened.failed,
    saveFailed,
    /** Adds a blank note at the top, in the folder given, and returns it. */
    add: (folder = '') => {
      const note = { ...createNote(), folder }
      commit((current) => ({ ...current, notes: [note, ...current.notes] }))
      return note
    },
    update: updateNote,
    /** Keeps a new, empty folder. The name is already checked (see `checkFolderName`). */
    createFolder: (name: string) => changeFolders((notes) => notes, { added: name }),
    /** Renames a folder, moving its notes with it. */
    renameFolder: (from: string, to: string) => changeFolders((notes) => refileNotes(notes, from, to), { renamed: [from, to] }),
    /** Deletes a folder; its notes become unfiled, and none is deleted. */
    deleteFolder: (name: string) => changeFolders((notes) => refileNotes(notes, name, ''), { renamed: [name, null] }),
    /** Moves one note to a folder, new or existing, or to '' for unfiled. */
    moveNote: (id: string, folder: string) =>
      changeFolders((notes) => notes.map((note) => (note.id === id ? applyChanges(note, { folder }) : note)), { added: folder || undefined }),
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
          ...current,
          notes: current.notes.filter((note) => note.id !== id),
          versions: current.versions.filter((version) => version.noteId !== id),
        }
      }),
    /** Puts a deleted note back as it was; the list orders it by its own dates. */
    restore: (note: Note) =>
      commit((current) => ({
        ...current,
        notes: [note, ...current.notes],
        versions: [...removedVersions.current.filter((version) => version.noteId === note.id), ...current.versions],
      })),
  }
}
