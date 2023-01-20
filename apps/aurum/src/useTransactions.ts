import type { SyncState } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { BUDGET_CODEC, newBudget, readBudgets, type Budget } from './budgets'
import { createRecurring, readRecurring, RECURRING_CODEC, setPaused, type RecurringFields, type RecurringItem } from './recurring'
import { BUDGETS, fetchRemote, fetchRows, pushChanges, pushRows, RECURRING } from './remote'
import {
  BUDGETS_KEY,
  loadBudgets,
  loadRecurring,
  loadStamps,
  loadTransactions,
  NO_BUDGETS,
  NO_RECURRING,
  RECURRING_KEY,
  save,
  SYNC_KEY,
  TRANSACTIONS_KEY,
  type SavedBudgets,
  type SavedRecurring,
} from './storage'
import { merge, mergeRecords, NO_STAMPS, readRemote, stampDeletions, stampRemoved, type Stamps } from './sync'
import { applyChanges, byDate, createTransaction, todayKey, type Transaction, type TransactionFields } from './transactions'

/** One wording for a failed sync, on the page and in the account dialog. */
export const SYNC_FAILED = 'Couldn’t sync with your account. Your changes are kept on this device.'

interface Saved {
  transactions: Transaction[]
  stamps: Stamps
  budgets: SavedBudgets
  recurring: SavedRecurring
}

const EMPTY: Saved = { transactions: [], stamps: NO_STAMPS, budgets: NO_BUDGETS, recurring: NO_RECURRING }

/** A short pause gathers a burst of changes into one sync. */
const SYNC_DELAY = 2000

function load(): Saved {
  const stamps = loadStamps()
  // Transactions with no owner can only come from tampering or an old bug: no one gets them.
  return stamps.owner === null
    ? EMPTY
    : { transactions: loadTransactions(), stamps, budgets: loadBudgets(), recurring: loadRecurring() }
}

/**
 * The signed-in account's transactions, budgets and recurring items, saved to
 * this device on every change and merged with the account: on sign-in, after
 * changes, and when the page comes back into view or online. Each sync then
 * has the account post the recurring items that fell due. The device's copy
 * belongs to one account at a time; signing out (here or in another app)
 * removes it.
 */
export function useTransactions(client: SupabaseClient | null) {
  const [saved, setSaved] = useState<Saved>(load)
  // Whether the last write of each key failed; the alert shows while any did.
  const [failed, setFailed] = useState({ transactions: false, stamps: false, budgets: false, recurring: false })
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
    const budgetsFailed = current.budgets === next.budgets ? null : !save(BUDGETS_KEY, next.budgets)
    const recurringFailed = current.recurring === next.recurring ? null : !save(RECURRING_KEY, next.recurring)
    // The owner goes last: if a write fails on an account switch, the old account's data is not left under the new owner.
    const stampsFailed = current.stamps === next.stamps ? null : !save(SYNC_KEY, next.stamps)
    latest.current = next
    setSaved(next)
    setFailed((flags) => ({
      transactions: transactionsFailed ?? flags.transactions,
      stamps: stampsFailed ?? flags.stamps,
      budgets: budgetsFailed ?? flags.budgets,
      recurring: recurringFailed ?? flags.recurring,
    }))
  }

  /** A change made here: deletions are stamped, and the change is synced. */
  function commit(change: (current: Transaction[]) => Transaction[]) {
    const current = latest.current
    const transactions = change(current.transactions)
    const stamps = stampDeletions(current.transactions, transactions, current.stamps, new Date().toISOString())
    store({ ...current, transactions, stamps })
    setEdits((count) => count + 1)
  }

  /** The same for budgets: removals are stamped, and the change is synced. */
  function commitBudgets(change: (current: Budget[]) => Budget[]) {
    const current = latest.current
    const budgets = change(current.budgets.budgets)
    const deleted = stampRemoved(
      BUDGET_CODEC.key,
      current.budgets.budgets,
      budgets,
      current.budgets.deleted,
      new Date().toISOString(),
    )
    store({ ...current, budgets: { budgets, deleted } })
    setEdits((count) => count + 1)
  }

  /** The same for recurring items. */
  function commitRecurring(change: (current: RecurringItem[]) => RecurringItem[]) {
    const current = latest.current
    const items = change(current.recurring.items)
    const deleted = stampRemoved(
      RECURRING_CODEC.key,
      current.recurring.items,
      items,
      current.recurring.deleted,
      new Date().toISOString(),
    )
    store({ ...current, recurring: { items, deleted } })
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
        const [budgetRows, recurringRows, rows] = await Promise.all([
          fetchRows(client, BUDGETS),
          fetchRows(client, RECURRING),
          fetchRemote(client),
        ])
        // Signed out while the requests were out: the data is no longer this account's.
        if (latest.current.stamps.owner !== user) return false
        const current = latest.current
        const budgets = mergeRecords(BUDGET_CODEC, current.budgets.budgets, current.budgets.deleted, readBudgets(budgetRows))
        const recurring = mergeRecords(
          RECURRING_CODEC,
          current.recurring.items,
          current.recurring.deleted,
          readRecurring(recurringRows),
        )
        const result = merge(current.transactions, current.stamps, readRemote(rows))
        store({
          transactions: result.transactions,
          stamps: result.stamps,
          budgets: { budgets: budgets.items, deleted: budgets.deleted },
          recurring: { items: recurring.items, deleted: recurring.deleted },
        })
        setFetched(true)
        await pushRows(client, BUDGETS, budgets.push, user)
        await pushRows(client, RECURRING, recurring.push, user)
        await pushChanges(client, result.push, user)
        // After the push, so a pause or a new item made here counts. What it posts comes down in one more round.
        const { data: posted, error } = await client.rpc('process_due_recurring', { p_today: todayKey() })
        if (error) throw error
        if (posted) queued.current = true
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
    if (latest.current.stamps.owner !== user) store(user ? { ...EMPTY, stamps: { owner: user, deleted: {} } } : EMPTY)
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
    budgets: saved.budgets.budgets,
    /** For the Plan view: false until the account has been read once, unless this device already had budgets or recurring items. */
    planReady: fetched || saved.budgets.budgets.length > 0 || saved.recurring.items.length > 0,
    saveFailed: failed.transactions || failed.stamps || failed.budgets || failed.recurring,
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
    /** Sets the category's monthly limit, replacing any it had. */
    setBudget: (category: string, amount: number) => {
      const budget = newBudget(category, amount)
      commitBudgets((current) => [budget, ...current.filter((b) => b.category !== budget.category)])
    },
    removeBudget: (category: string) => commitBudgets((current) => current.filter((b) => b.category !== category)),
    /** Oldest first. */
    recurring: [...saved.recurring.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    addRecurring: (fields: RecurringFields) => {
      const item = createRecurring(fields)
      commitRecurring((current) => [...current, item])
    },
    setRecurringPaused: (id: string, paused: boolean) =>
      commitRecurring((current) => current.map((item) => (item.id === id ? setPaused(item, paused, todayKey()) : item))),
    removeRecurring: (id: string) => commitRecurring((current) => current.filter((item) => item.id !== id)),
  }
}
