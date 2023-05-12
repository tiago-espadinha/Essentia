import { storedUserId, type SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { supabasePort } from '../data/remote'
import { loadTasks, saveTasks, STORAGE_KEY } from '../data/storage'
import {
  change, claim, claimable, conflictOf, keepMine, syncAccount, takeTheirs, visibleTasks, type ConflictKind,
} from '../data/sync'
import { ACCOUNT_PREFIX, emptyAccount, readAccountState, writeAccountState, type AccountState } from '../data/syncStorage'
import { applyDraft, createTask, newId, type Task, type TaskDraft } from '../domain/tasks'

export type { SyncState }

/** One wording for a failed sync, on the page and in the account dialog. */
export const SYNC_FAILED = 'Couldn’t sync with your account. Your changes are kept on this device.'

/** A burst of changes goes up in one sync. */
const SYNC_DELAY = 1500

/** Whose tasks are shown: the ones made while signed out, or an account's copy. */
type Source = { kind: 'local'; tasks: Task[] } | { kind: 'account'; state: AccountState; readable: boolean }

function openAccount(owner: string): Source {
  const read = readAccountState(owner)
  // An unreadable copy may hold unsent work: it is left as it is, never overwritten.
  return read.status === 'ok'
    ? { kind: 'account', state: read.state, readable: true }
    : { kind: 'account', state: emptyAccount(owner), readable: false }
}

function initial(client: SupabaseClient | null): Source {
  const owner = client && storedUserId()
  return owner ? openAccount(owner) : { kind: 'local', tasks: loadTasks() }
}

/** Signed-out tasks this account hasn't taken or set aside yet. */
const waiting = (state: AccountState) =>
  state.declined ? [] : loadTasks().filter((task) => !state.legacyIds[task.id] && claimable(task))

/**
 * The task list. Signed out it lives on this device only, as before. Signed in
 * it is the account's copy: kept on this device under the account, and synced
 * after changes, on sign-in, and when the page comes back into view or online.
 */
export function useTasks(client: SupabaseClient | null = null) {
  const [source, setSource] = useState<Source>(() => initial(client))
  // Syncs finish after renders; they work on the newest copy, not the one they started from.
  const latest = useRef(source)
  const [saveFailed, setSaveFailed] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('off')
  const [edits, setEdits] = useState(0)
  const [asking, setAsking] = useState(0)
  // Bumped on every sign-in, sign-out and switch: a sync from before drops its results.
  const generation = useRef(0)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const queued = useRef(false)
  // The shown copy holds changes storage refused: they build on it, and nothing is sent until it is stored.
  const unsaved = useRef(false)

  function show(next: Source) {
    latest.current = next
    setSource(next)
  }

  /** Applies a change to the freshest stored copy, which another tab may have moved on. */
  function updateAccount(edit: (state: AccountState) => AccountState): boolean {
    const current = latest.current
    if (current.kind !== 'account') return false
    const stored = current.readable ? readAccountState(current.state.owner) : { status: 'error' as const }
    const next = edit(stored.status === 'ok' && !unsaved.current ? stored.state : current.state)
    const saved = stored.status === 'ok' && writeAccountState(next)
    unsaved.current = !saved
    show({ ...current, state: next })
    setSaveFailed(!saved)
    return saved
  }

  function commit(edit: (state: AccountState) => AccountState, localTasks: (tasks: Task[]) => Task[]) {
    const current = latest.current
    if (current.kind === 'local') {
      const tasks = localTasks(current.tasks)
      show({ kind: 'local', tasks })
      setSaveFailed(!saveTasks(tasks))
      return
    }
    updateAccount(edit)
    setEdits((count) => count + 1)
  }

  /** Resolves to whether every change on this device is in the account, conflicts settled. */
  function sync(): Promise<boolean> {
    const current = latest.current
    if (!client || current.kind !== 'account' || !current.readable || unsaved.current || current.state.owner !== storedUserId()) {
      return Promise.resolve(false)
    }
    if (inFlight.current) {
      queued.current = true
      return inFlight.current
    }
    const run = runSync(client, current.state.owner, generation.current)
    inFlight.current = run
    void run.finally(() => {
      if (inFlight.current === run) inFlight.current = null
    })
    return run
  }

  async function runSync(client: SupabaseClient, owner: string, started: number): Promise<boolean> {
    const isCurrent = () => generation.current === started
    setSyncState('syncing')
    try {
      let settled: boolean
      do {
        queued.current = false
        settled = await syncAccount(owner, supabasePort(client), {
          get: () => (latest.current.kind === 'account' ? latest.current.state : emptyAccount(owner)),
          update: updateAccount,
          current: isCurrent,
        })
      } while (queued.current && isCurrent())
      // Conflicts waiting on their rows are no sync failure; a copy storage refused is.
      if (isCurrent()) setSyncState(unsaved.current ? 'failed' : 'synced')
      return settled && isCurrent()
    } catch {
      // Shown with a retry; every unsent change stays queued on this device.
      if (isCurrent()) setSyncState('failed')
      return false
    }
  }

  const syncNow = useEffectEvent(() => void sync())

  /** Shows the copy of the account now signed in, or the signed-out list. */
  const switchTo = useEffectEvent((user: string | null) => {
    const current = latest.current
    // Offline with an expired token, Supabase reports no session yet keeps it: the copy stays until the session goes.
    if (!user && current.kind === 'account' && storedUserId() === current.state.owner) return
    if (!user || current.kind !== 'account' || current.state.owner !== user) {
      generation.current++
      inFlight.current = null
      unsaved.current = false
      setSaveFailed(false)
      setAsking(0)
      if (!user) {
        show({ kind: 'local', tasks: loadTasks() })
        setSyncState('off')
        return
      }
      show(openAccount(user))
    }
    const next = latest.current
    if (next.kind === 'account' && next.readable) {
      finishClaim(next.state)
      setAsking(waiting(next.state).length)
    }
    // Supabase asks not to call it from inside its own auth callback.
    setTimeout(syncNow, 0)
  })

  /** Removes from the signed-out list what the account has taken, even after a crash in between. */
  function finishClaim(state: AccountState) {
    const legacy = loadTasks()
    const left = legacy.filter((task) => !state.legacyIds[task.id])
    if (left.length < legacy.length) saveTasks(left)
  }

  useEffect(() => {
    if (!client) return
    const { data } = client.auth.onAuthStateChange((_event, session) => switchTo(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [client])

  useEffect(() => {
    if (edits === 0) return
    const timer = setTimeout(syncNow, SYNC_DELAY)
    return () => clearTimeout(timer)
  }, [edits])

  const reload = useEffectEvent((key: string | null) => {
    const current = latest.current
    if (current.kind === 'local' && (key === null || key === STORAGE_KEY)) show({ kind: 'local', tasks: loadTasks() })
    if (current.kind === 'account' && (key === null || key === ACCOUNT_PREFIX + current.state.owner)) {
      const read = readAccountState(current.state.owner)
      if (read.status === 'ok') show({ ...current, state: read.state })
    }
  })

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') syncNow()
    }
    // Another tab changed the list.
    const onStorage = (event: StorageEvent) => reload(event.key)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('online', onReturn)
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('online', onReturn)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const tasks = source.kind === 'local' ? source.tasks : visibleTasks(source.state)
  const edit = (id: string, next: (task: Task) => Task | null) => {
    const task = tasks.find((candidate) => candidate.id === id)
    if (!task) return
    const changed = next(task)
    commit(
      (state) => change(state, id, changed, newId()),
      (list) => (changed ? list.map((candidate) => (candidate.id === id ? changed : candidate)) : list.filter((candidate) => candidate.id !== id)),
    )
  }
  const resolve = (resolution: (state: AccountState) => AccountState) => {
    updateAccount(resolution)
    void sync()
  }

  return {
    tasks,
    /** The signed-in account, or null for the signed-out list: transient state resets when it changes. */
    owner: source.kind === 'account' ? source.state.owner : null,
    saveFailed,
    syncState,
    sync,
    /** How many signed-out tasks wait for `answer`; 0 when there is no question. */
    unclaimed: asking,
    /** Adds the waiting signed-out tasks to the account, or keeps them on this device for when signed out. */
    answer: (add: boolean) => {
      if (asking === 0) return
      setAsking(0)
      const saved = updateAccount((state) => (add ? claim(state, waiting(state), newId).state : { ...state, declined: true }))
      // The signed-out copy goes only once the account's has been stored.
      if (saved && add && latest.current.kind === 'account') finishClaim(latest.current.state)
      void sync()
    },
    conflictOf: (id: string): ConflictKind | null => (source.kind === 'account' ? conflictOf(source.state, id) : null),
    keepMine: (id: string) => resolve((state) => keepMine(state, id, newId())),
    takeTheirs: (id: string) => resolve((state) => takeTheirs(state, id)),
    add: (text: string, due = '') => {
      const task = createTask(text, undefined, due)
      commit((state) => change(state, task.id, task, newId()), (list) => [task, ...list])
    },
    toggle: (id: string) => edit(id, (task) => ({ ...task, completed: !task.completed })),
    remove: (id: string) => edit(id, () => null),
    /** Puts a deleted task back before the task that followed it, or at the end. */
    restore: (task: Task, beforeId: string | null) =>
      commit(
        (state) => change(state, task.id, task, newId(), beforeId),
        (list) => {
          const index = list.findIndex((candidate) => candidate.id === beforeId)
          return list.toSpliced(index === -1 ? list.length : index, 0, task)
        },
      ),
    update: (id: string, draft: TaskDraft) => edit(id, (task) => applyDraft(task, draft) ?? task),
  }
}
