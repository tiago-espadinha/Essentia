// Test helper: the account's notes and folders tables in memory, scoped per
// user as row level security does, behind the few client calls Folio makes.
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { vi } from 'vitest'

export type Row = Record<string, unknown> & { user_id: string }
type Session = { user: { id: string; email?: string } } | null

/** Lets the deferred sync and its requests finish. */
export const settle = () => act(() => vi.advanceTimersByTimeAsync(2500))

export function fakeServer() {
  const tables: Record<string, Row[]> = { documents: [], note_folders: [] }
  const keyOf: Record<string, string[]> = { documents: ['id'], note_folders: ['user_id', 'name'] }
  const calls = { upserts: [] as { table: string; rows: Record<string, unknown>[] }[], tables: new Set<string>() }
  let failing = false
  let delay = 0

  function client(start: Session) {
    let session = start
    const listeners = new Set<(event: string, session: Session) => void>()
    const user = () => session?.user.id
    const reply = (data: unknown) => (failing ? { data: null, error: new Error('offline') } : { data, error: null })
    const result = (data: unknown) =>
      delay ? new Promise((resolve) => setTimeout(() => resolve(reply(data)), delay)) : Promise.resolve(reply(data))
    const from = (table: string) => {
      calls.tables.add(table)
      const rows = tables[table]
      const own = () => rows.filter((row) => row.user_id === user())
      const same = (a: Record<string, unknown>, b: Record<string, unknown>) => keyOf[table].every((column) => a[column] === b[column])
      return {
        select: () => {
          const query = {
            order: () => query,
            range: (start: number, end: number) =>
              result(own().slice(start, end + 1).map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'user_id')))),
          }
          return query
        },
        upsert: (sent: Record<string, unknown>[]) => {
          if (failing) return result(null)
          calls.upserts.push({ table, rows: sent })
          const incoming = sent.map((row) => ({ user_id: user(), ...row }) as Row)
          // Row level security: a row for another account, or over another account's row, is refused, all or nothing.
          if (incoming.some((row) => row.user_id !== user() || rows.some((t) => same(t, row) && t.user_id !== user()))) {
            return Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') })
          }
          for (const row of incoming) {
            const index = rows.findIndex((existing) => same(existing, row))
            if (index === -1) rows.push(row)
            else rows[index] = { ...rows[index], ...row }
          }
          return result(null)
        },
        update: (changes: Record<string, unknown>) => {
          const filters: [string, unknown][] = []
          const chain = {
            eq: (column: string, value: unknown) => {
              filters.push([column, value])
              return chain
            },
            lt: (_column: string, before: string) => {
              if (failing) return result(null)
              for (const row of own()) {
                if (filters.every(([column, value]) => row[column] === value) && Date.parse(String(row.updated_at)) < Date.parse(before)) {
                  Object.assign(row, changes)
                }
              }
              return result(null)
            },
          }
          return chain
        },
      }
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
      session = id ? { user: { id, email: `${id}@example.com` } } : null
      act(() => listeners.forEach((listener) => listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session)))
    }
    return { client: { from, auth } as unknown as SupabaseClient, emit }
  }

  return {
    tables,
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
  auth: { onAuthStateChange: (callback: never) => account.client.auth.onAuthStateChange(callback) },
} as unknown as SupabaseClient
