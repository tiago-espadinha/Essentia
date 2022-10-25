// Test helper: the account's documents table in memory, scoped per user as row
// level security does, behind the few client calls the app makes.
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { vi } from 'vitest'

export type Row = Record<string, unknown> & { id: string; user_id: string }
type Session = { user: { id: string } } | null

/** Applies a change and its effects, then lets the deferred sync and its requests finish. */
export async function settle(change: () => void = () => {}) {
  act(change)
  await act(() => vi.advanceTimersByTimeAsync(2500))
}

export function fakeServer() {
  const documents: Row[] = []
  const calls = { upserts: 0 }
  let failing = false
  // How long each reply takes; whether it fails is decided when it arrives.
  let delay = 0

  function client(session: Session) {
    let listener: (event: string, session: Session) => void = () => {}
    const user = () => session?.user.id
    const reply = (data: unknown) => (failing ? { data: null, error: new Error('offline') } : { data, error: null })
    const result = (data: unknown) =>
      delay ? new Promise((resolve) => setTimeout(() => resolve(reply(data)), delay)) : Promise.resolve(reply(data))
    const own = () => documents.filter((row) => row.user_id === user())
    const from = () => ({
      select: () => {
        const query = {
          order: () => query,
          range: (start: number, end: number) =>
            result(
              own()
                .slice(start, end + 1)
                .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'user_id'))),
            ),
        }
        return query
      },
      upsert: (rows: Record<string, unknown>[]) => {
        if (failing) return result(null)
        calls.upserts += 1
        for (const row of rows) {
          const index = documents.findIndex((existing) => existing.id === row.id)
          const stored = { ...documents[index], ...row, user_id: user()! } as Row
          if (index === -1) documents.push(stored)
          else documents[index] = stored
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
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback
        queueMicrotask(() => callback('INITIAL_SESSION', session))
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    }
    /** Switches the session (as another tab would) without letting time pass. */
    const emit = (id: string | null) => {
      session = id ? { user: { id } } : null
      act(() => listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session))
    }
    const signInAs = async (id: string | null) => {
      emit(id)
      await settle()
    }
    return { client: { from, auth } as unknown as SupabaseClient, signInAs, emit }
  }

  return {
    documents,
    calls,
    client,
    fail: (value: boolean) => (failing = value),
    slow: (ms: number) => (delay = ms),
  }
}
