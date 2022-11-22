// Test helper: the account's transactions table in memory, scoped per user as
// row level security does, behind the few client calls the app makes.
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { vi } from 'vitest'

export type Row = Record<string, unknown> & { id: string; user_id: string }
type Session = { user: { id: string; email?: string } } | null

/** Applies a change and its effects, then lets the deferred sync and its requests finish. */
export async function settle(change: () => void = () => {}) {
  act(change)
  await act(() => vi.advanceTimersByTimeAsync(2500))
}

export function fakeServer() {
  const transactions: Row[] = []
  const calls = { upserts: 0 }
  let failing = false
  // How long each reply takes; whether it fails is decided when it arrives.
  let delay = 0

  function client(session: Session) {
    // The app's session hook and the transactions hook both listen.
    const listeners = new Set<(event: string, session: Session) => void>()
    const user = () => session?.user.id
    const reply = (data: unknown) => (failing ? { data: null, error: new Error('offline') } : { data, error: null })
    const result = (data: unknown) =>
      delay ? new Promise((resolve) => setTimeout(() => resolve(reply(data)), delay)) : Promise.resolve(reply(data))
    const own = () => transactions.filter((row) => row.user_id === user())
    const from = () => ({
      select: () => {
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
                .filter((row) => row.id > after)
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, count)
                .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'user_id'))),
            ),
        }
        return query
      },
      upsert: (rows: Record<string, unknown>[]) => {
        if (failing) return result(null)
        calls.upserts += 1
        // Row level security: a row for another account than the session's is refused, all or nothing.
        if (rows.some((row) => row.user_id !== user() || transactions.some((t) => t.id === row.id && t.user_id !== user()))) {
          return Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') })
        }
        for (const row of rows) {
          const index = transactions.findIndex((existing) => existing.id === row.id)
          const stored = { ...transactions[index], ...row } as Row
          if (index === -1) transactions.push(stored)
          else transactions[index] = stored
        }
        return result(null)
      },
      update: (changes: Record<string, unknown>) => ({
        eq: (_column: string, id: string) => ({
          lt: (_stamp: string, before: string) => {
            if (failing) return result(null)
            const row = own().find((existing) => existing.id === id)
            if (row && Date.parse(String(row.updated_at)) < Date.parse(before)) Object.assign(row, changes)
            return result(null)
          },
        }),
      }),
    })
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
    return { client: { from, auth } as unknown as SupabaseClient, signInAs, emit }
  }

  return {
    transactions,
    calls,
    client,
    fail: (value: boolean) => (failing = value),
    slow: (ms: number) => (delay = ms),
  }
}
