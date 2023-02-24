import type { SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { applyDraft, createHabit, logValue, todayKey, toggleDay, type Habit, type HabitDraft } from './habits'
import { fetchRemote, pushChanges } from './remote'
import { FIRST_DAY, loadHabits, loadStamps, saveHabits, saveStamps } from './storage'
import { merge, NO_STAMPS, readRemote, stampChanges, type Stamps } from './sync'

export type { SyncState }

/** One wording for a failed sync, on the page and in the account dialog. */
export const SYNC_FAILED = 'Couldn’t sync with your account. Your changes are kept on this device.'

interface Saved {
  habits: Habit[]
  stamps: Stamps
}

/** A burst of check-ins goes up in one sync. */
const SYNC_DELAY = 1500

/**
 * The habit list, saved to this device on every change and, when signed in,
 * merged with the account: on sign-in, after local changes, and when the page
 * comes back into view or online. The device's copy belongs to one account at
 * a time; signing out (here or in another app) removes it.
 */
export function useHabits(client: SupabaseClient | null = null) {
  const [saved, setSaved] = useState<Saved>(() => ({ habits: loadHabits(), stamps: loadStamps() }))
  // Syncs finish after renders; they merge into the newest list, not the one they started from.
  const latest = useRef(saved)
  const [saveFailed, setSaveFailed] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('off')
  const [edits, setEdits] = useState(0)
  // Signed in with habits made while signed out: they wait for the person to keep or remove them.
  const [asking, setAsking] = useState(false)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const queued = useRef(false)
  // Set by Supabase's auth events, which can come from another app or tab.
  const userId = useRef<string | null>(null)

  function store(next: Saved) {
    latest.current = next
    setSaved(next)
    const habitsSaved = saveHabits(next.habits)
    const stampsSaved = saveStamps(next.stamps)
    setSaveFailed(!habitsSaved || !stampsSaved)
  }

  function commit(habits: Habit[]) {
    const { habits: before, stamps } = latest.current
    store({ habits, stamps: stampChanges(before, habits, stamps, new Date().toISOString()) })
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
    })
    return inFlight.current
  }

  async function run(client: SupabaseClient, user: string): Promise<boolean> {
    setSyncState('syncing')
    try {
      do {
        queued.current = false
        const fetched = await fetchRemote(client)
        // Signed out while the request was out: the list is no longer this account's.
        if (latest.current.stamps.owner !== user) return false
        const remote = readRemote(fetched.habits, fetched.checkIns, FIRST_DAY, todayKey())
        const result = merge(latest.current.habits, latest.current.stamps, remote, new Date().toISOString())
        store({ habits: result.habits, stamps: result.stamps })
        await pushChanges(client, result.push, user)
      } while (queued.current)
      setSyncState('synced')
      return true
    } catch {
      // Shown with a retry; the changes stay on this device and go up next time.
      setSyncState('failed')
      return false
    }
  }

  const syncNow = useEffectEvent(() => void sync())

  /**
   * Gives the device's list to the account now signed in, clearing another
   * account's. Habits made while signed out may be someone else's on a shared
   * device, so those wait for `answer`.
   */
  const claim = useEffectEvent((user: string | null) => {
    userId.current = user
    setAsking(false)
    const { owner } = latest.current.stamps
    if (owner !== null && owner !== user) store({ habits: [], stamps: NO_STAMPS })
    if (!user) {
      setSyncState('off')
      return
    }
    if (latest.current.stamps.owner === null && latest.current.habits.length > 0) {
      setAsking(true)
      return
    }
    take(user, true)
    // Supabase asks not to call it from inside its own auth callback.
    setTimeout(syncNow, 0)
  })

  /** Makes the device's list the account's, or starts it empty, before the first sync. */
  function take(user: string, keep: boolean) {
    if (latest.current.stamps.owner === user) return
    store(keep ? { ...latest.current, stamps: { ...latest.current.stamps, owner: user } } : { habits: [], stamps: { ...NO_STAMPS, owner: user } })
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

  const { habits } = saved
  const change = (id: string, edit: (habit: Habit) => Habit) =>
    commit(habits.map((habit) => (habit.id === id ? edit(habit) : habit)))

  return {
    habits,
    /** How many habits made while signed out wait for `answer`; 0 when there is no question. */
    unclaimed: asking ? habits.length : 0,
    /** Adds the waiting habits to the account, or removes them from this device. */
    answer: (add: boolean) => {
      if (!asking || !userId.current) return
      setAsking(false)
      take(userId.current, add)
      void sync()
    },
    saveFailed,
    syncState,
    sync,
    /** Returns false when the draft has no name. */
    add: (draft: HabitDraft) => {
      const habit = createHabit(draft)
      if (habit) commit([habit, ...habits])
      return habit !== null
    },
    update: (id: string, draft: HabitDraft) => change(id, (habit) => applyDraft(habit, draft) ?? habit),
    toggle: (id: string, day: string) => change(id, (habit) => toggleDay(habit, day)),
    log: (id: string, day: string, value: number) => change(id, (habit) => logValue(habit, day, value)),
    remove: (id: string) => commit(habits.filter((habit) => habit.id !== id)),
    /** Puts a deleted habit back before the habit that followed it, or at the end. */
    restore: (habit: Habit, beforeId: string | null) => {
      const index = habits.findIndex((candidate) => candidate.id === beforeId)
      commit(habits.toSpliced(index === -1 ? habits.length : index, 0, habit))
    },
  }
}
