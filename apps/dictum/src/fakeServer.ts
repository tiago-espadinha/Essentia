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
    // Every subscriber hears each event, as with Supabase: the app's auth state and its documents.
    const listeners = new Set<(event: string, session: Session) => void>()
    const user = () => session?.user.id
    const reply = (data: unknown) => (failing ? { data: null, error: new Error('offline') } : { data, error: null })
    const result = (data: unknown) =>
      delay ? new Promise((resolve) => setTimeout(() => resolve(reply(data)), delay)) : Promise.resolve(reply(data))
    const own = () => documents.filter((row) => row.user_id === user())
    const from = () => ({
      select: () => {
        const query = {
          order: () => query,
          eq: (_column: string, id: string) => ({
            maybeSingle: () => {
              const row = own().find((existing) => existing.id === id)
              return result(row ? { share_id: row.share_id ?? null } : null)
            },
          }),
          range: (start: number, end: number) =>
            result(
              own()
                .slice(start, end + 1)
                .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'user_id'))),
            ),
        }
        return query
      },
      upsert: (sent: Record<string, unknown>[]) => {
        if (failing) return result(null)
        calls.upserts += 1
        // user_id defaults to the session's user, as in the table.
        const rows: Record<string, unknown>[] = sent.map((row) => ({ user_id: user(), ...row }))
        // Row level security: a row for another account than the session's is refused, all or nothing.
        if (rows.some((row) => row.user_id !== user() || documents.some((t) => t.id === row.id && t.user_id !== user()))) {
          return Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') })
        }
        for (const row of rows) {
          const index = documents.findIndex((existing) => existing.id === row.id)
          const stored = { ...documents[index], ...row } as Row
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
    // The sharing functions of the migration: owner-only changes, a link read by anyone.
    const rpc = (name: string, args: Record<string, string>) => {
      if (failing) return result(null)
      if (name === 'get_shared_document') {
        const row = documents.find((existing) => existing.share_id === args.link_id && !existing.deleted_at)
        return result(row ? [{ title: row.title, content: row.content, updated_at: row.updated_at }] : [])
      }
      const row = own().find((existing) => existing.id === args.document_id && !existing.deleted_at)
      if (name === 'share_document') {
        if (row) row.share_id ??= crypto.randomUUID()
        return result(row?.share_id ?? null)
      }
      if (row) row.share_id = null
      return result(null)
    }
    const auth = {
      onAuthStateChange: (callback: (event: string, session: Session) => void) => {
        listeners.add(callback)
        queueMicrotask(() => callback('INITIAL_SESSION', session))
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
      },
    }
    /** Switches the session (as another tab would) without letting time pass. */
    const emit = (id: string | null) => {
      session = id ? { user: { id } } : null
      act(() => listeners.forEach((listener) => listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session)))
    }
    const signInAs = async (id: string | null) => {
      emit(id)
      await settle()
    }
    /** Another tab's sign-in replaced the stored session; this tab hears of it later. */
    const swapToken = (id: string) => {
      session = { user: { id } }
    }
    return { client: { from, rpc, auth } as unknown as SupabaseClient, signInAs, emit, swapToken }
  }

  return {
    documents,
    calls,
    client,
    fail: (value: boolean) => (failing = value),
    slow: (ms: number) => (delay = ms),
  }
}

/**
 * The app reads its client once, at import. A test file mocks `getSupabase` to
 * return `appClient`, which forwards to whichever client `account.client` holds.
 */
export const account = { client: null as unknown as SupabaseClient }

export const appClient = {
  from: (table: string) => account.client.from(table),
  rpc: (name: string, args: object) => account.client.rpc(name, args),
  auth: { onAuthStateChange: (callback: never) => account.client.auth.onAuthStateChange(callback) },
} as unknown as SupabaseClient
