import { storedUserId, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { convert } from '../domain/convert'
import { applyChanges, createNote, foldersOf, refileNotes, type Note, type NoteChanges, type NoteVersion } from '../domain/notes'
import { addVersion } from '../domain/versions'
import { openNotes } from '../data/migrate'
import { fetchRemote, pushChanges } from '../data/remote'
import {
  clearKept, FOLDERS_KEY, joinKept, loadFolders, loadKept, loadNotes, loadStamps, loadVersions, NOTES_KEY, save,
  saveFolders, saveNotes, saveStamps, setAside, SYNC_KEY, VERSIONS_KEY,
} from '../data/storage'
import { merge, NO_STAMPS, readRemote, readRemoteFolders, sharedNoteIds, stampDeletions, stampFolders, type Stamps } from '../data/sync'

/** One wording for a failed sync, on the page and in the account dialog. */
export const SYNC_FAILED = 'Couldn’t sync with your account. Your notes are kept on this device.'

/** A pause in typing sends the note up in one sync. */
const SYNC_DELAY = 2000

interface Store {
  notes: Note[]
  versions: NoteVersion[]
  /** Folders kept on their own; notes can be in others too (see `foldersOf`). */
  folders: string[]
  stamps: Stamps
}

/** New lists each time, not shared ones: clearing then writes them over the stored copy. */
const empty = (stamps: Stamps): Store => ({ notes: [], versions: [], folders: [], stamps })

function read(): Store {
  const notes = loadNotes()
  return { notes, versions: loadVersions(notes.map((note) => note.id)), folders: loadFolders(), stamps: loadStamps() }
}

/**
 * Opens the store, taking in the old stores. Another account's notes, or ones
 * whose session has gone, never paint: the auth event then clears them.
 */
function open(): { store: Store; failed: boolean } {
  const opened = openNotes(undefined, storedUserId())
  const stamps = loadStamps()
  if (stamps.owner !== null && stamps.owner !== storedUserId()) return { store: empty(stamps), failed: opened.failed }
  const store = { notes: opened.notes, versions: opened.versions, folders: loadFolders(), stamps }
  if (stamps.owner !== null || opened.failed) return { store, failed: opened.failed }
  // Signed out since (here or in another app): the notes kept on this device only come back.
  const kept = loadKept()
  if (kept.notes.length === 0 && kept.folders.length === 0) return { store, failed: false }
  const joined = joinKept(store, kept)
  if (saveNotes(joined.notes) && save(VERSIONS_KEY, joined.versions) && saveFolders(joined.folders)) clearKept()
  return { store: { ...joined, stamps }, failed: false }
}

/**
 * The notes, their versions and folders: taken in from the old Folio and
 * Dictum stores on load, saved to this device on every change and, when signed
 * in, merged with the account on sign-in, after edits, and when the page comes
 * back into view or online. Versions stay on this device. The device's notes
 * belong to one account at a time; signing out (here or in another app) removes
 * them, and brings back the notes kept on this device only.
 */
export function useNotes(client: SupabaseClient | null = null) {
  const [opened] = useState(open)
  const [store, setStore] = useState<Store>(opened.store)
  // Notes that could not be stored stay as they are, so a later load can still take them in.
  const [readOnly, setReadOnly] = useState(opened.failed)
  const readOnlyRef = useRef(opened.failed)
  const [saveFailed, setSaveFailed] = useState(false)
  // Several changes can land in one event (a conversion saves a version, then
  // the note), and syncs finish after renders, so each builds on the last one.
  const latest = useRef(store)
  // The versions of the latest deleted note, put back if it is restored.
  const removedVersions = useRef<NoteVersion[]>([])
  const [syncState, setSyncState] = useState<SyncState>('off')
  const [edits, setEdits] = useState(0)
  // Signed in with notes made while signed out: they wait for the person to add or keep them.
  const [asking, setAsking] = useState(false)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const queued = useRef(false)
  // Set by Supabase's auth events, which can come from another app or tab.
  const userId = useRef<string | null>(null)
  // The account's notes that have a share link, as of the last sync or share change; never stored.
  const [shared, setShared] = useState<string[]>([])

  function show(next: Store) {
    latest.current = next
    setStore(next)
  }

  /** Writes what changed and shows `next`; false when the browser refused any of it. */
  function write(next: Store): boolean {
    const current = latest.current
    const notesSaved = next.notes === current.notes || saveNotes(next.notes)
    const versionsSaved = next.versions === current.versions || save(VERSIONS_KEY, next.versions)
    const foldersSaved = next.folders === current.folders || saveFolders(next.folders)
    const stampsSaved = next.stamps === current.stamps || saveStamps(next.stamps)
    // Notes that could not be stored are kept until the page closes; versions are not, so a
    // version is never taken as saved first (before a conversion, say) when it only lives here.
    show(versionsSaved ? next : { ...next, versions: current.versions })
    const saved = notesSaved && versionsSaved && foldersSaved && stampsSaved
    setSaveFailed(!saved)
    return saved
  }

  /** Brings back the notes kept on this device only, once no account owns the notes. */
  function takeBackKept() {
    const kept = loadKept()
    if (kept.notes.length === 0 && kept.folders.length === 0) return clearKept()
    const current = latest.current
    const joined = joinKept(current, kept)
    if (write({ ...current, ...joined })) clearKept()
  }

  /** Applies a change made here and stores it; false when it could not be stored on this device. */
  function commit(change: (current: Store) => Store): boolean {
    if (readOnlyRef.current) return false
    const current = latest.current
    let next = change(current)
    // Only an account's copy remembers what changed, for the next sync.
    if (next.stamps.owner !== null && (next.notes !== current.notes || next.folders !== current.folders)) {
      const at = new Date().toISOString()
      let stamps = stampDeletions(current.notes, next.notes, next.stamps, at)
      if (next.folders !== current.folders) stamps = stampFolders(current.folders, next.folders, stamps, at)
      next = { ...next, stamps }
    }
    const saved = write(next)
    if (next.notes !== current.notes || next.folders !== current.folders) setEdits((count) => count + 1)
    return saved
  }

  /** Resolves to whether everything on this device reached the account. */
  function sync(): Promise<boolean> {
    if (!client || !userId.current || readOnlyRef.current || latest.current.stamps.owner !== userId.current) return Promise.resolve(false)
    if (inFlight.current) {
      queued.current = true
      return inFlight.current
    }
    inFlight.current = run(client, userId.current).finally(() => {
      inFlight.current = null
      // Asked for while another account's run was out (a switch in another tab): it still has to happen.
      if (queued.current) void sync()
    })
    return inFlight.current
  }

  async function run(client: SupabaseClient, user: string): Promise<boolean> {
    setSyncState('syncing')
    try {
      do {
        queued.current = false
        const fetched = await fetchRemote(client)
        // Signed out while the request was out: the notes are no longer this account's.
        if (latest.current.stamps.owner !== user) return false
        setShared(sharedNoteIds(fetched.notes))
        const current = latest.current
        const result = merge(
          { notes: current.notes, folders: current.folders },
          current.stamps,
          { notes: readRemote(fetched.notes), folders: readRemoteFolders(fetched.folders) },
          new Date().toISOString(),
        )
        const kept = new Set(result.notes.map((note) => note.id))
        write({
          notes: result.notes,
          versions: current.versions.filter((version) => kept.has(version.noteId)),
          folders: result.folders,
          stamps: result.stamps,
        })
        await pushChanges(client, result.push, user)
      } while (queued.current)
      setSyncState('synced')
      return true
    } catch {
      // A request that failed because the account signed out meanwhile is no failure to show.
      if (latest.current.stamps.owner !== user) return false
      // Shown with a retry; the changes stay on this device and go up next time.
      setSyncState('failed')
      return false
    }
  }

  const syncNow = useEffectEvent(() => void sync())

  /** Makes the notes the account's, takes in Dictum's copy of that account, and syncs. */
  function take(user: string, stamps: Stamps) {
    if (!write({ ...latest.current, stamps: { ...stamps, owner: user } })) return
    const opened = openNotes(undefined, user)
    readOnlyRef.current = opened.failed
    setReadOnly(opened.failed)
    show(read())
    // Supabase asks not to call it from inside its own auth callback.
    setTimeout(() => void sync(), 0)
  }

  /**
   * Gives the device's notes to the account now signed in, clearing another
   * account's. Notes made while signed out may be someone else's on a shared
   * device, so those wait for `answer`.
   */
  const claim = useEffectEvent((user: string | null) => {
    userId.current = user
    setAsking(false)
    // Another account's links, or none signed out; the next sync reads this account's.
    setShared([])
    const { owner } = latest.current.stamps
    // Offline with an expired token, Supabase reports no session yet keeps it: the copy stays until the session goes.
    // Another account's copy; signing out may have removed it already.
    if (owner !== null && owner !== (user ?? storedUserId())) write(empty({ ...NO_STAMPS }))
    // No account owns the notes (another tab may have cleared them first): the notes kept here come back.
    if (latest.current.stamps.owner === null) takeBackKept()
    if (!user) {
      setSyncState('off')
      return
    }
    const current = latest.current
    if (current.stamps.owner === user) setTimeout(syncNow, 0)
    else if (current.notes.length > 0 || current.folders.length > 0) setAsking(true)
    else take(user, current.stamps)
  })

  useEffect(() => {
    if (!client) return
    const { data } = client.auth.onAuthStateChange((_event, session) => claim(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [client])

  // Another tab can change the store, taking notes in, editing them or signing
  // out: its copy replaces this one, so the next change here does not write over it.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== null && ![NOTES_KEY, VERSIONS_KEY, FOLDERS_KEY, SYNC_KEY].includes(event.key)) return
      const next = read()
      // Another tab answered the question: these notes are an account's now.
      if (next.stamps.owner !== null) setAsking(false)
      show(next.stamps.owner !== null && next.stamps.owner !== storedUserId() ? empty(next.stamps) : next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (edits === 0) return
    const timer = setTimeout(syncNow, SYNC_DELAY)
    return () => clearTimeout(timer)
  }, [edits])

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') syncNow()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('online', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('online', onReturn)
    }
  }, [])

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
    readOnly,
    saveFailed,
    syncState,
    sync,
    /** The ids of the account's notes that have a share link. */
    shared,
    /** Records a share change made through the account (see `ShareDialog`). */
    markShared: (id: string, on: boolean) =>
      setShared((current) => (on ? (current.includes(id) ? current : [...current, id]) : current.filter((other) => other !== id))),
    /** How many notes made while signed out wait for `answer`; 0 when there is no question. */
    unclaimed: asking ? store.notes.length : 0,
    /**
     * Adds the waiting notes and folders to the account, or keeps them on this
     * device only: set aside, out of the account, until it signs out.
     */
    answer: (add: boolean) => {
      const user = userId.current
      const current = latest.current
      // Only notes no account owns are asked about; read-only notes are not stored yet, so they wait.
      if (!asking || !user || current.stamps.owner !== null || readOnlyRef.current) return
      if (add) {
        setAsking(false)
        // Folders made while signed out outrank an old deletion of the same name in the account.
        take(user, stampFolders([], current.folders, current.stamps, new Date().toISOString()))
        return
      }
      if (!setAside({ notes: current.notes, versions: current.versions, folders: current.folders })) return setSaveFailed(true)
      setAsking(false)
      if (!write(empty(current.stamps))) return
      take(user, current.stamps)
    },
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
    /**
     * Puts a deleted note back as it was, so the list orders it by its own dates.
     * An account's note counts as changed, so it outranks a deletion that already
     * reached the account.
     */
    restore: (note: Note) =>
      commit((current) => ({
        ...current,
        notes: [current.stamps.owner === null ? note : applyChanges(note, {}), ...current.notes],
        versions: [...removedVersions.current.filter((version) => version.noteId === note.id), ...current.versions],
      })),
  }
}
