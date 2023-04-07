import { storedUserId, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { applyChanges, createDoc, type Doc, type DocChanges } from '../domain/documents'
import { fetchRemote, pushChanges } from '../data/remote'
import { DOCS_KEY, loadDocs, loadMoved, loadStamps, loadVersions, save, SYNC_KEY, VERSIONS_KEY } from '../data/storage'
import { merge, NO_STAMPS, readRemote, stampDeletions, type Stamps } from '../data/sync'
import { addVersion, type Version } from '../domain/versions'

/** One wording for a failed sync, on the page and in the account dialog. */
export const SYNC_FAILED = 'Couldn’t sync with your account. Your documents are kept on this device.'

interface Saved {
  docs: Doc[]
  versions: Version[]
  stamps: Stamps
}

const EMPTY: Saved = { docs: [], versions: [], stamps: NO_STAMPS }

/** A pause in typing sends the document up in one sync. */
const SYNC_DELAY = 2000

/** Documents Folio has taken in: stored as they were, but not shown, synced or claimed here. */
interface Moved {
  docs: Doc[]
  versions: Version[]
}

const NO_MOVED: Moved = { docs: [], versions: [] }

/** Takes out of `saved` the documents Folio has taken in by now; they join `moved`. */
function split(saved: Saved, moved: Moved): { saved: Saved; moved: Moved } {
  const ids = loadMoved()
  if (!saved.docs.some((doc) => ids.has(doc.id))) return { saved, moved }
  return {
    saved: {
      ...saved,
      docs: saved.docs.filter((doc) => !ids.has(doc.id)),
      versions: saved.versions.filter((version) => !ids.has(version.docId)),
    },
    moved: {
      docs: [...moved.docs, ...saved.docs.filter((doc) => ids.has(doc.id))],
      versions: [...moved.versions, ...saved.versions.filter((version) => ids.has(version.docId))],
    },
  }
}

function load(): { saved: Saved; moved: Moved } {
  const stamps = loadStamps()
  // Another account's documents, or ones whose session has gone, never paint; the auth event then clears them.
  // New arrays, not EMPTY's: clearing then writes them over the stored copy.
  if (stamps.owner !== null && stamps.owner !== storedUserId()) {
    return { saved: { docs: [], versions: [], stamps }, moved: NO_MOVED }
  }
  const docs = loadDocs()
  return split({ docs, versions: loadVersions(docs.map((doc) => doc.id)), stamps }, NO_MOVED)
}

/**
 * The documents and their versions, saved to this device on every change and,
 * when signed in, merged with the account: on sign-in, after edits, and when the
 * page comes back into view or online. Versions stay on this device. The
 * device's copy belongs to one account at a time; signing out (here or in
 * another app) removes it.
 */
export function useDocuments(client: SupabaseClient | null = null) {
  const [initial] = useState(load)
  const [saved, setSaved] = useState<Saved>(initial.saved)
  // Folio can take documents in while this page is open, so each store looks again.
  const [moved, setMoved] = useState(initial.moved)
  const movedRef = useRef(moved)
  // Whether the last write of each list failed; the alert shows while any did.
  const [failed, setFailed] = useState({ docs: false, versions: false, stamps: false })
  // Several changes can land in one event (a restore saves a version, then the text),
  // and syncs finish after renders, so each change builds on the newest state.
  const latest = useRef(saved)
  const [syncState, setSyncState] = useState<SyncState>('off')
  const [edits, setEdits] = useState(0)
  // Signed in with documents made while signed out: they wait for the person to keep or remove them.
  const [asking, setAsking] = useState(false)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const queued = useRef(false)
  // Set by Supabase's auth events, which can come from another app or tab.
  const userId = useRef<string | null>(null)

  function setMovedDocs(next: Moved) {
    movedRef.current = next
    setMoved(next)
  }

  function store(requested: Saved) {
    const current = latest.current
    const { saved: next, moved: nowMoved } = split(requested, movedRef.current)
    if (nowMoved !== movedRef.current) setMovedDocs(nowMoved)
    // Only what changed is written, so only it updates its flag. Moved documents are written back as they were.
    const docsFailed = current.docs === next.docs ? null : !save(DOCS_KEY, [...next.docs, ...nowMoved.docs])
    const versionsFailed = current.versions === next.versions ? null : !save(VERSIONS_KEY, [...next.versions, ...nowMoved.versions])
    const stampsFailed = current.stamps === next.stamps ? null : !save(SYNC_KEY, next.stamps)
    latest.current = next
    setSaved(next)
    setFailed((flags) => ({
      docs: docsFailed ?? flags.docs,
      versions: versionsFailed ?? flags.versions,
      stamps: stampsFailed ?? flags.stamps,
    }))
  }

  /** A change made here: deletions are stamped, and a change to the documents is synced. */
  function commit(change: (current: Saved) => Saved) {
    const current = latest.current
    const next = change(current)
    if (next.docs === current.docs) return store(next)
    store({ ...next, stamps: stampDeletions(current.docs, next.docs, next.stamps, new Date().toISOString()) })
    setEdits((count) => count + 1)
  }

  /** Resolves to whether everything on this device reached the account. */
  function sync(): Promise<boolean> {
    if (!client || !userId.current || latest.current.stamps.owner !== userId.current) return Promise.resolve(false)
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
        // Signed out while the request was out: the documents are no longer this account's.
        if (latest.current.stamps.owner !== user) return false
        const result = merge(latest.current.docs, latest.current.stamps, readRemote(fetched))
        const kept = new Set(result.docs.map((doc) => doc.id))
        store({
          docs: result.docs,
          versions: latest.current.versions.filter((version) => kept.has(version.docId)),
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

  /**
   * Gives the device's documents to the account now signed in, clearing another
   * account's. Documents made while signed out may be someone else's on a
   * shared device, so those wait for `answer`.
   */
  const claim = useEffectEvent((user: string | null) => {
    userId.current = user
    setAsking(false)
    const { owner } = latest.current.stamps
    // Offline with an expired token, Supabase reports no session yet keeps it: the copy stays until the session goes.
    if (owner !== null && owner !== (user ?? storedUserId())) {
      // Folio already keeps the moved documents: clearing the account's copy takes them too.
      setMovedDocs(NO_MOVED)
      store(EMPTY)
    }
    if (!user) {
      setSyncState('off')
      return
    }
    // Documents Folio took in since the page opened are neither asked about nor claimed.
    store(latest.current)
    if (latest.current.stamps.owner === null && latest.current.docs.length > 0) {
      setAsking(true)
      return
    }
    take(user, true)
    // Supabase asks not to call it from inside its own auth callback.
    setTimeout(syncNow, 0)
  })

  /** Makes the device's documents the account's, or starts it empty, before the first sync. */
  function take(user: string, keep: boolean) {
    if (latest.current.stamps.owner === user) return
    store(keep ? { ...latest.current, stamps: { ...latest.current.stamps, owner: user } } : { ...EMPTY, stamps: { ...NO_STAMPS, owner: user } })
  }

  useEffect(() => {
    if (!client) return
    const { data } = client.auth.onAuthStateChange((_event, session) => claim(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [client])

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

  const updateDoc = (id: string, changes: DocChanges) =>
    commit((current) => ({
      ...current,
      docs: current.docs.map((doc) => (doc.id === id ? applyChanges(doc, changes) : doc)),
    }))

  const saveVersion = (id: string) =>
    commit((current) => {
      const doc = current.docs.find((d) => d.id === id)
      return doc ? { ...current, versions: addVersion(current.versions, doc) } : current
    })

  return {
    docs: saved.docs,
    /** Documents Folio now keeps; listed here only as links. */
    moved: moved.docs,
    /** How many documents made while signed out wait for `answer`; 0 when there is no question. */
    unclaimed: asking ? saved.docs.length : 0,
    /** Adds the waiting documents to the account, or removes them (and their versions) from this device. */
    answer: (add: boolean) => {
      if (!asking || !userId.current) return
      setAsking(false)
      take(userId.current, add)
      void sync()
    },
    versions: saved.versions,
    saveFailed: failed.docs || failed.versions || failed.stamps,
    syncState,
    sync,
    /** Adds a blank document in the folder and returns it. */
    add: (folder = '') => {
      const doc = createDoc(folder)
      commit((current) => ({ ...current, docs: [doc, ...current.docs] }))
      return doc
    },
    update: updateDoc,
    /** Saves the document as a version, unless its newest version is the same. */
    saveVersion,
    /** Saves the current text as a version first, so the restore can itself be undone. */
    restore: (id: string, version: Version) => {
      saveVersion(id)
      updateDoc(id, { title: version.title, content: version.content })
    },
    /** Removes the document and its versions, and returns them for an undo. */
    remove: (id: string) => {
      const removed = {
        docs: latest.current.docs.filter((doc) => doc.id === id),
        versions: latest.current.versions.filter((version) => version.docId === id),
      }
      commit((current) => ({
        ...current,
        docs: current.docs.filter((doc) => doc.id !== id),
        versions: current.versions.filter((version) => version.docId !== id),
      }))
      return removed
    },
    /**
     * Puts back what `remove` returned. It counts as a change, so it outranks a
     * deletion that already reached the account.
     */
    putBack: (removed: { docs: Doc[]; versions: Version[] }) =>
      commit((current) => ({
        ...current,
        docs: [...removed.docs.map((doc) => applyChanges(doc, {})), ...current.docs],
        versions: [...removed.versions, ...current.versions],
      })),
  }
}
