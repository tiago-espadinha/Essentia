import type { SupabaseClient } from '@supabase/supabase-js'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './storage'
import { TODAY_DATE } from './testing'
import { useHabits } from './useHabits'

type Row = Record<string, unknown>
type Session = { user: { id: string } } | null

/**
 * The account's tables in memory, scoped per user as row level security does,
 * behind the few client calls the hook makes.
 */
function fakeServer() {
  const tables: Record<string, (Row & { user_id: string })[]> = { habits: [], check_ins: [] }
  const keyOf = (table: string, row: Row) => (table === 'habits' ? String(row.id) : `${row.habit_id}/${row.day}`)
  let failing = false

  function client(session: Session) {
    let listener: (event: string, session: Session) => void = () => {}
    let swapTo: string | null = null
    const user = () => session?.user.id
    const result = (data: unknown) => Promise.resolve(failing ? { data: null, error: new Error('offline') } : { data, error: null })
    const from = (table: string) => ({
      select: () => {
        const query = {
          order: () => query,
          range: (start: number, end: number) => {
            const rows = tables[table]
              .filter((row) => row.user_id === user())
              .slice(start, end + 1)
              .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'user_id')))
            if (swapTo) session = { user: { id: swapTo } }
            return result(rows)
          },
        }
        return query
      },
      upsert: (sent: Row[]) => {
        if (failing) return result(null)
        // user_id defaults to the session's user, as in the tables.
        const rows = sent.map((row) => ({ user_id: user(), ...row }))
        // Row level security: a row for another account than the session's is refused, all or nothing.
        const others = (row: Row) => tables[table].some((t) => keyOf(table, t) === keyOf(table, row) && t.user_id !== user())
        if (rows.some((row) => row.user_id !== user() || others(row))) {
          return Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') })
        }
        for (const row of rows) {
          const index = tables[table].findIndex((existing) => keyOf(table, existing) === keyOf(table, row))
          const stored = { ...row, user_id: String(row.user_id) }
          if (index === -1) tables[table].push(stored)
          else tables[table][index] = stored
        }
        return result(null)
      },
      update: (changes: Row) => ({
        eq: (_column: string, id: string) => {
          if (failing) return result(null)
          const row = tables[table].find((existing) => existing.id === id && existing.user_id === user())
          if (row) Object.assign(row, changes)
          return result(null)
        },
      }),
    })
    const auth = {
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback
        queueMicrotask(() => callback('INITIAL_SESSION', session))
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    }
    const signInAs = async (id: string | null) => {
      session = id ? { user: { id } } : null
      await settle(() => listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session))
    }
    /** Another tab's sign-in replaces the stored session while this tab's next read is out; this tab hears of it later. */
    const swapTokenOnRead = (id: string) => {
      swapTo = id
    }
    return { client: { from, auth } as unknown as SupabaseClient, signInAs, swapTokenOnRead }
  }

  return { tables, client, fail: (value: boolean) => (failing = value) }
}

/** Applies a change and its effects, then lets the deferred sync and its requests finish. */
async function settle(change: () => void = () => {}) {
  act(change)
  await act(() => vi.advanceTimersByTimeAsync(2000))
}

const rendered: { current: ReturnType<typeof useHabits> | null } = { current: null }
const hook = () => rendered.current!
let root: Root
let container: HTMLElement

function Probe({ client }: { client: SupabaseClient }) {
  const value = useHabits(client)
  useEffect(() => {
    rendered.current = value
  })
  return null
}

/** Renders without letting the auth event in: what the first paint shows. */
function paint(client: SupabaseClient) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root.render(<Probe client={client} />))
}

async function open(client: SupabaseClient) {
  paint(client)
  await settle()
}

function close() {
  act(() => root.unmount())
  container.remove()
}

const draft = (name: string) => ({ name, category: '', days: [], unit: '', target: null })
const names = () => hook().habits.map((habit) => habit.name)

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(TODAY_DATE)
})

afterEach(() => {
  if (container?.isConnected) close()
  vi.useRealTimers()
})

describe('syncing habits with the account', () => {
  it('uploads habits made before signing in once asked to, and they appear on another device', async () => {
    const server = fakeServer()
    const laptop = server.client(null)
    await open(laptop.client)
    await settle(() => hook().add(draft('Read')))
    expect(hook().syncState).toBe('off')

    await laptop.signInAs('ana')
    expect(hook().unclaimed).toBe(1)
    expect(server.tables.habits).toEqual([])
    await settle(() => hook().answer(true))
    expect(hook().unclaimed).toBe(0)
    expect(hook().syncState).toBe('synced')
    await settle(() => hook().toggle(hook().habits[0].id, '2022-08-15'))
    close()

    localStorage.clear()
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    expect(names()).toEqual(['Read'])
    expect(hook().habits[0].log).toEqual({ '2022-08-15': 1 })
  })

  it('removes habits made before signing in when told to, and shows the account’s own', async () => {
    const server = fakeServer()
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    await settle(() => hook().add(draft('Ana’s habit')))
    close()

    localStorage.clear()
    const shared = server.client(null)
    await open(shared.client)
    await settle(() => hook().add(draft('Someone else’s habit')))
    await shared.signInAs('ana')
    expect(names()).toEqual(['Someone else’s habit'])
    expect(hook().syncState).toBe('off')

    await settle(() => hook().answer(false))
    expect(names()).toEqual(['Ana’s habit'])
    expect(server.tables.habits.map((row) => row.name)).toEqual(['Ana’s habit'])
  })

  it('asks nothing when the device has no habits of its own, and drops the question on sign-out', async () => {
    const server = fakeServer()
    const device = server.client(null)
    await open(device.client)
    await device.signInAs('ana')
    expect(hook().unclaimed).toBe(0)
    expect(hook().syncState).toBe('synced')
    await device.signInAs(null)

    await settle(() => hook().add(draft('Read')))
    await device.signInAs('ben')
    expect(hook().unclaimed).toBe(1)
    await device.signInAs(null)
    expect(hook().unclaimed).toBe(0)
    expect(names()).toEqual(['Read'])
  })

  it('clears the device on sign-out, and the habits come back on signing in again', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    await settle(() => hook().add(draft('Read')))

    await device.signInAs(null)
    expect(names()).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([])

    await device.signInAs('ana')
    expect(names()).toEqual(['Read'])
  })

  it('never writes one account’s habits under another’s session', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    device.swapTokenOnRead('ben')
    await settle(() => hook().add(draft('Ana’s habit')))
    expect(server.tables.habits.filter((row) => row.user_id === 'ben')).toEqual([])
    expect(hook().syncState).toBe('failed')
    expect(names()).toEqual(['Ana’s habit'])
  })

  it('never shows one account’s habits to the next account on the same device', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    await settle(() => hook().add(draft('Ana’s habit')))
    close()

    // Signed out in another app, then Ben signs in here.
    const shared = server.client({ user: { id: 'ben' } })
    await open(shared.client)
    expect(names()).toEqual([])
    await settle(() => hook().add(draft('Ben’s habit')))
    expect(server.tables.habits.map((row) => [row.name, row.user_id])).toEqual([
      ['Ana’s habit', 'ana'],
      ['Ben’s habit', 'ben'],
    ])
  })

  it('keeps changes on the device when a sync fails, and sends them on retry', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.fail(true)
    await settle(() => hook().add(draft('Read')))
    expect(hook().syncState).toBe('failed')
    expect(names()).toEqual(['Read'])

    server.fail(false)
    await act(async () => {
      await hook().sync()
    })
    expect(hook().syncState).toBe('synced')
    expect(server.tables.habits.map((row) => row.name)).toEqual(['Read'])
  })
})

describe('the first paint after opening', () => {
  beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'))
  afterEach(() => vi.unstubAllEnvs())

  async function leaveAnasCopy(server: ReturnType<typeof fakeServer>) {
    await open(server.client({ user: { id: 'ana' } }).client)
    await settle(() => hook().add(draft('Ana’s habit')))
    close()
  }

  it('holds back an account’s habits when this device has no session for it', async () => {
    const server = fakeServer()
    await leaveAnasCopy(server)

    // Ana's session ended while no app was open.
    paint(server.client(null).client)
    expect(names()).toEqual([])
    await settle()
    expect(names()).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([])
  })

  it('keeps the account’s copy offline with an expired token, when Supabase reports no session but keeps it', async () => {
    const server = fakeServer()
    await leaveAnasCopy(server)
    localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: { id: 'ana' } }))

    await open(server.client(null).client)
    expect(names()).toEqual(['Ana’s habit'])
    expect(hook().syncState).toBe('off')
  })

  it('paints the signed-in account’s own habits at once', async () => {
    const server = fakeServer()
    await leaveAnasCopy(server)
    localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: { id: 'ana' } }))

    paint(server.client({ user: { id: 'ana' } }).client)
    expect(names()).toEqual(['Ana’s habit'])
  })
})
