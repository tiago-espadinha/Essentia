// Test helper: the account's tables in memory, scoped per user as row level
// security does, behind the few client calls the app makes.
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { vi } from 'vitest'
import { occurrence, type Frequency } from './recurring'

export type Row = Record<string, unknown> & { user_id: string }

/** The column that names a row for its owner, and the primary key upserts meet on. */
const TABLES = {
  transactions: { key: 'id', conflict: ['id'] },
  budgets: { key: 'category', conflict: ['user_id', 'category'] },
  recurring_transactions: { key: 'id', conflict: ['id'] },
}
type TableName = keyof typeof TABLES
type Session = { user: { id: string; email?: string } } | null

/** Applies a change and its effects, then lets the deferred sync and its requests finish. */
export async function settle(change: () => void = () => {}) {
  act(change)
  await act(() => vi.advanceTimersByTimeAsync(2500))
}

export function fakeServer() {
  const tables: Record<TableName, Row[]> = { transactions: [], budgets: [], recurring_transactions: [] }
  const calls = { upserts: 0, posts: 0 }
  let failing = false
  // Fails only the recurring rpc, or only one table's upserts.
  let rpcFailing = false
  let failingTable: TableName | null = null
  // How long each reply takes; whether it fails is decided when it arrives.
  let delay = 0

  function client(session: Session) {
    // The app's session hook and the transactions hook both listen.
    const listeners = new Set<(event: string, session: Session) => void>()
    const user = () => session?.user.id
    const reply = (data: unknown) => (failing ? { data: null, error: new Error('offline') } : { data, error: null })
    const result = (data: unknown) =>
      delay ? new Promise((resolve) => setTimeout(() => resolve(reply(data)), delay)) : Promise.resolve(reply(data))
    const from = (name: TableName) => {
      const rows = tables[name]
      const { key, conflict } = TABLES[name]
      const own = () => rows.filter((row) => row.user_id === user())
      const keyOf = (row: Record<string, unknown>) => String(row[key])
      const same = (a: Record<string, unknown>, b: Record<string, unknown>) => conflict.every((column) => a[column] === b[column])
      return {
        // Answers only the columns asked for, as PostgREST does, so a missing one shows.
        select: (columns: string) => {
          const picked = columns.split(',').map((column) => column.trim())
          let after = ''
          const query = {
            order: () => query,
            gt: (_column: string, id: string) => {
              after = id
              return query
            },
            limit: (count: number) =>
              result(
                own()
                  .filter((row) => keyOf(row) > after)
                  .sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
                  .slice(0, count)
                  .map((row) => Object.fromEntries(picked.filter((column) => column in row).map((column) => [column, row[column]]))),
              ),
          }
          return query
        },
        upsert: (changes: Record<string, unknown>[]) => {
          if (failing) return result(null)
          if (failingTable === name) return Promise.resolve({ data: null, error: new Error('table unavailable') })
          calls.upserts += 1
          // Row level security: a row for another account than the session's is refused, all or nothing.
          if (changes.some((row) => row.user_id !== user() || rows.some((t) => same(t, row) && t.user_id !== user()))) {
            return Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') })
          }
          for (const row of changes) {
            const index = rows.findIndex((existing) => same(existing, row))
            const stored = { ...rows[index], ...row } as Row
            if (index === -1) rows.push(stored)
            else rows[index] = stored
          }
          return result(null)
        },
        update: (changes: Record<string, unknown>) => ({
          eq: (_column: string, id: string) => ({
            lt: (_stamp: string, before: string) => {
              if (failing) return result(null)
              const row = own().find((existing) => keyOf(existing) === id)
              if (row && Date.parse(String(row.updated_at)) < Date.parse(before)) Object.assign(row, changes)
              return result(null)
            },
          }),
        }),
      }
    }
    /** process_due_recurring, as supabase/migration.sql has it: posts each due occurrence once. */
    const rpc = (_name: string, { p_today }: { p_today: string }) => {
      if (failing) return result(null)
      if (rpcFailing) return Promise.resolve({ data: null, error: new Error('rpc unavailable') })
      calls.posts += 1
      let posted = 0
      for (const item of tables.recurring_transactions) {
        if (item.user_id !== user() || item.deleted_at) continue
        const pausedOn = item.paused_on ? String(item.paused_on) : null
        const resumedOn = String(item.resumed_on ?? pausedOn)
        let count = Number(item.posted ?? 0)
        for (
          let day = occurrence(String(item.start_on), item.frequency as Frequency, count);
          day <= p_today && !(item.paused && pausedOn && day >= pausedOn);
        ) {
          const taken = tables.transactions.some((t) => t.recurring_id === item.id && t.recurring_on === day)
          if (!taken && (!pausedOn || day < pausedOn || day >= resumedOn)) {
            const now = new Date().toISOString()
            const { user_id, description, amount, type, category } = item
            tables.transactions.push({
              id: crypto.randomUUID(),
              user_id,
              description,
              amount,
              type,
              category,
              occurred_on: day,
              created_at: now,
              updated_at: now,
              deleted_at: null,
              recurring_id: item.id,
              recurring_on: day,
            })
            posted += 1
          }
          count += 1
          day = occurrence(String(item.start_on), item.frequency as Frequency, count)
        }
        item.posted = count
      }
      return result(posted)
    }
    const auth = {
      onAuthStateChange: (callback: (event: string, session: Session) => void) => {
        listeners.add(callback)
        queueMicrotask(() => callback('INITIAL_SESSION', session))
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
      },
      signOut: async () => {
        emit(null)
        return { error: null }
      },
    }
    /** Switches the session (as another tab would) without letting time pass. */
    const emit = (id: string | null) => {
      session = id ? { user: { id, email: `${id}@example.com` } } : null
      act(() => {
        for (const listener of listeners) listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session)
      })
    }
    const signInAs = async (id: string | null) => {
      emit(id)
      await settle()
    }
    return { client: { from, rpc, auth } as unknown as SupabaseClient, signInAs, emit }
  }

  return {
    transactions: tables.transactions,
    budgets: tables.budgets,
    recurring: tables.recurring_transactions,
    calls,
    client,
    fail: (value: boolean) => (failing = value),
    failRpc: (value: boolean) => (rpcFailing = value),
    failTable: (name: TableName | null) => (failingTable = name),
    slow: (ms: number) => (delay = ms),
  }
}
