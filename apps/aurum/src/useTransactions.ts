import type { SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { fetchRemote, pushChanges } from './remote'
import { loadStamps, loadTransactions, save, SYNC_KEY, TRANSACTIONS_KEY } from './storage'
import { merge, NO_STAMPS, readRemote, stampDeletions, type Stamps } from './sync'
import { applyChanges, byDate, createTransaction, type Transaction, type TransactionFields } from './transactions'

/** One wording for a failed sync, on the page and in the account dialog. */
export const SYNC_FAILED = 'Couldn’t sync with your account. Your transactions are kept on this device.'

interface Saved {
  transactions: Transaction[]
  stamps: Stamps
}

const EMPTY: Saved = { transactions: [], stamps: NO_STAMPS }

/** A short pause gathers a burst of changes into one sync. */
const SYNC_DELAY = 2000

function load(): Saved {
  const stamps = loadStamps()
  // Transactions with no owner can only come from tampering or an old bug: no one gets them.
  return stamps.owner === null ? EMPTY : { transactions: loadTransactions(), stamps }
}

/**
 * The signed-in account's transactions, saved to this device on every change
 * and merged with the account: on sign-in, after changes, and when the page
 * comes back into view or online. The device's copy belongs to one account at
 * a time; signing out (here or in another app) removes it.
 */
export function useTransactions(client: SupabaseClient | null) {
  const [saved, setSaved] = useState<Saved>(load)
  // Whether the last write of each key failed; the alert shows while either did.
  const [failed, setFailed] = useState({ transactions: false, stamps: false })
  // Syncs finish after renders, so each change builds on the newest state.
  const latest = useRef(saved)
  const [syncState, setSyncState] = useState<SyncState>('off')
  // Whether this account has been fetched since it signed in, so an empty list means empty.
  const [fetched, setFetched] = useState(false)
  const [edits, setEdits] = useState(0)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const queued = useRef(false)
  // Set by Supabase's auth events, which can come from another app or tab.
  const userId = useRef<string | null>(null)

  function store(next: Saved) {
    const current = latest.current
    // Only what changed is written, so only it updates its flag.
    const transactionsFailed = current.transactions === next.transactions ? null : !save(TRANSACTIONS_KEY, next.transactions)
    const stampsFailed = current.stamps === next.stamps ? null : !save(SYNC_KEY, next.stamps)
    latest.current = next
    setSaved(next)
    setFailed((flags) => ({
      transactions: transactionsFailed ?? flags.transactions,
      stamps: stampsFailed ?? flags.stamps,
    }))
  }

  /** A change made here: deletions are stamped, and the change is synced. */
  function commit(change: (current: Transaction[]) => Transaction[]) {
    const current = latest.current
    const transactions = change(current.transactions)
    store({ transactions, stamps: stampDeletions(current.transactions, transactions, current.stamps, new Date().toISOString()) })
    setEdits((count) => count + 1)
  }

  /** Resolves to whether everything on this device reached the account. */
  function sync(): Promise<boolean> {
    if (!client || !userId.current) return Promise.resolve(false)
    if (inFlight.current) {
      queued.current = true
      return inFlight.current
    }
    const user = userId.current
    inFlight.current = run(client, user).finally(() => {
      inFlight.current = null
      // Asked for meanwhile, or the account switched (in another tab) while this run was out: the new one still has to happen.
      if (queued.current || userId.current !== user) void sync()
    })
    return inFlight.current
  }

  async function run(client: SupabaseClient, user: string): Promise<boolean> {
    setSyncState('syncing')
    try {
      do {
        queued.current = false
        const rows = await fetchRemote(client)
        // Signed out while the request was out: the transactions are no longer this account's.
        if (latest.current.stamps.owner !== user) return false
        const result = merge(latest.current.transactions, latest.current.stamps, readRemote(rows))
        store({ transactions: result.transactions, stamps: result.stamps })
        setFetched(true)
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

  /** Gives the device's copy to the account now signed in, clearing another account's. */
  const claim = useEffectEvent((user: string | null) => {
    if (userId.current !== user) setFetched(false)
    userId.current = user
    if (latest.current.stamps.owner !== user) store(user ? { transactions: [], stamps: { owner: user, deleted: {} } } : EMPTY)
    if (!user) {
      setSyncState('off')
      return
    }
    // Supabase asks not to call it from inside its own auth callback.
    setTimeout(syncNow, 0)
  })

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

  return {
    /** Newest first. */
    transactions: [...saved.transactions].sort(byDate),
    /** False until the account has been read once, unless this device already had its transactions. */
    ready: fetched || saved.transactions.length > 0,
    saveFailed: failed.transactions || failed.stamps,
    syncState,
    sync,
    add: (fields: TransactionFields) => {
      const transaction = createTransaction(fields)
      commit((current) => [transaction, ...current])
      return transaction
    },
    /** Many at once, as one change and one sync: a CSV import. */
    addAll: (list: TransactionFields[]) => {
      const now = new Date()
      commit((current) => [...list.map((fields) => createTransaction(fields, now)), ...current])
    },
    update: (id: string, changes: Partial<TransactionFields>) =>
      commit((current) => current.map((t) => (t.id === id ? applyChanges(t, changes) : t))),
    remove: (id: string) => commit((current) => current.filter((t) => t.id !== id)),
    /**
     * Puts back a removed transaction. It counts as a change, so it outranks a
     * deletion that already reached the account.
     */
    putBack: (transaction: Transaction) =>
      // A sync since the deletion may have brought it back already; it is not listed twice.
      commit((current) => [applyChanges(transaction, {}), ...current.filter((t) => t.id !== transaction.id)]),
  }
}
