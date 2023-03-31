import type { SupabaseClient } from '@supabase/supabase-js'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { ACCOUNT_PREFIX, readAccountState } from '../data/syncStorage'
import { useTasks } from '../hooks/useTasks'
import { FakeAccount } from './fakeAccount'

const ANA = 'aaaaaaaa-0000-4000-8000-00000000000a'
const BEN = 'bbbbbbbb-0000-4000-8000-00000000000b'
const SESSION_KEY = 'sb-test-auth-token'

type Listener = (event: string, session: { user: { id: string } } | null) => void

/** The few client calls the hook makes, answered by one shared fake account. */
function fakeClient(server: FakeAccount, network: { down?: boolean } = {}) {
  let user: string | null = null
  let listener: Listener = () => {}
  const port = server.port(() => user, network)
  const query = {
    select: () => query,
    order: () => query,
    range: async () => {
      try {
        return { data: await port.read(), error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
  const client = {
    from: () => query,
    rpc: async (_name: string, args: Record<string, unknown>) => {
      try {
        const operation = { operationId: args.p_operation_id, taskId: args.p_task_id, expectedVersion: args.p_expected_version, content: args.p_content }
        return { data: await port.write(args.p_owner as string, operation as never), error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
    auth: {
      onAuthStateChange: (callback: Listener) => {
        listener = callback
        queueMicrotask(() => callback('INITIAL_SESSION', user ? { user: { id: user } } : null))
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  } as unknown as SupabaseClient
  /** Signs in or out, as Supabase does: the stored session first, then the event. */
  const signInAs = async (id: string | null) => {
    user = id
    if (id) localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id } }))
    else localStorage.removeItem(SESSION_KEY)
    await settle(() => listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null))
  }
  const restore = (id: string) => {
    user = id
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id } }))
  }
  return { client, signInAs, restore }
}

async function settle(change: () => void = () => {}) {
  act(change)
  await act(() => vi.advanceTimersByTimeAsync(2000))
}

const rendered: { current: ReturnType<typeof useTasks> | null } = { current: null }
const hook = () => rendered.current!
const texts = () => hook().tasks.map((task) => task.text)
let root: Root | null = null
let container: HTMLElement

function Probe({ client }: { client: SupabaseClient }) {
  const value = useTasks(client)
  useEffect(() => {
    rendered.current = value
  })
  return null
}

async function open(client: SupabaseClient) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root!.render(<Probe client={client} />))
  await settle()
}

function close() {
  act(() => root?.unmount())
  container.remove()
  root = null
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  vi.useFakeTimers()
})

afterEach(() => {
  if (root) close()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Acta with an account', () => {
  it('works as before while signed out, on this device only', async () => {
    const server = new FakeAccount()
    await open(fakeClient(server).client)
    await settle(() => hook().add('Offline task'))
    expect(texts()).toEqual(['Offline task'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1)
    expect(server.writes).toBe(0)
    expect(hook().syncState).toBe('off')
  })

  it('syncs changes to another device on the same account', async () => {
    const server = new FakeAccount()
    const laptop = fakeClient(server)
    await open(laptop.client)
    await laptop.signInAs(ANA)
    await settle(() => hook().add('Shared'))
    await settle(() => hook().toggle(hook().tasks[0].id))
    expect(hook().syncState).toBe('synced')
    close()

    localStorage.clear()
    const phone = fakeClient(server)
    phone.restore(ANA)
    await open(phone.client)
    expect(hook().tasks).toMatchObject([{ text: 'Shared', completed: true }])
  })

  it('asks before adding signed-out tasks, and adds them once', async () => {
    const server = new FakeAccount()
    const { client, signInAs } = fakeClient(server)
    await open(client)
    await settle(() => hook().add('Mine'))
    await signInAs(ANA)
    expect(hook().unclaimed).toBe(1)
    expect(server.writes).toBe(0)

    await settle(() => hook().answer(true))
    expect(texts()).toEqual(['Mine'])
    expect(server.read(ANA)).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([])

    close()
    await open(client)
    expect(hook().unclaimed).toBe(0)
    expect(server.read(ANA)).toHaveLength(1)
  })

  it('keeps declined tasks on the device and shows them again once signed out', async () => {
    const server = new FakeAccount()
    const { client, signInAs } = fakeClient(server)
    await open(client)
    await settle(() => hook().add('Private'))
    await signInAs(ANA)
    await settle(() => hook().answer(false))
    expect(texts()).toEqual([])
    expect(server.read(ANA)).toEqual([])

    close()
    await open(client)
    expect(hook().unclaimed).toBe(0)

    await signInAs(null)
    expect(texts()).toEqual(['Private'])
  })

  it('finishes a claim interrupted after the account’s copy was stored', async () => {
    const server = new FakeAccount()
    const { client, signInAs } = fakeClient(server)
    await open(client)
    await settle(() => hook().add('Half done'))
    const legacy = localStorage.getItem(STORAGE_KEY)!
    await signInAs(ANA)
    await settle(() => hook().answer(true))
    close()
    // A crash between storing the account's copy and clearing the signed-out one.
    localStorage.setItem(STORAGE_KEY, legacy)

    await open(client)
    expect(hook().unclaimed).toBe(0)
    expect(texts()).toEqual(['Half done'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([])
    expect(server.read(ANA)).toHaveLength(1)
  })

  it('keeps changes made offline and sends them when back online', async () => {
    const server = new FakeAccount()
    const network: { down?: boolean } = {}
    const { client, signInAs } = fakeClient(server, network)
    await open(client)
    await signInAs(ANA)
    network.down = true
    await settle(() => hook().add('Queued'))
    expect(hook().syncState).toBe('failed')
    expect(readAccountState(ANA)).toMatchObject({ status: 'ok', state: { operations: [{ content: { text: 'Queued' } }] } })

    network.down = false
    await settle(() => window.dispatchEvent(new Event('online')))
    expect(hook().syncState).toBe('synced')
    expect(server.read(ANA)).toHaveLength(1)
  })

  it('shows another account nothing of the last one’s', async () => {
    const server = new FakeAccount()
    const { client, signInAs } = fakeClient(server)
    await open(client)
    await signInAs(ANA)
    await settle(() => hook().add('Ana’s'))
    await signInAs(BEN)
    expect(texts()).toEqual([])
    expect(hook().owner).toBe(BEN)
    expect(server.read(BEN)).toEqual([])
  })

  it('reports false while a conflict waits, so sign-out warns', async () => {
    const server = new FakeAccount()
    const other = fakeClient(server)
    const { client, signInAs } = fakeClient(server)
    await open(client)
    await signInAs(ANA)
    await settle(() => hook().add('Plan'))
    const id = hook().tasks[0].id
    // Another device edits it first.
    other.restore(ANA)
    await other.client.rpc('acta_write_task', {
      p_owner: ANA, p_operation_id: 'cccccccc-0000-4000-8000-000000000002', p_task_id: id, p_expected_version: 1,
      p_content: { text: 'Theirs', completed: false, category: 'General', due: '' },
    })
    await settle(() => hook().update(id, { text: 'Mine', category: 'General', due: '' }))
    expect(hook().conflictOf(id)).toBe('changed')
    let settled = true
    await act(async () => { settled = await hook().sync() })
    expect(settled).toBe(false)

    await settle(() => hook().takeTheirs(id))
    expect(texts()).toEqual(['Theirs'])
    await act(async () => { settled = await hook().sync() })
    expect(settled).toBe(true)
  })

  it('takes another tab’s changes', async () => {
    const server = new FakeAccount()
    const { client, signInAs } = fakeClient(server)
    await open(client)
    await signInAs(ANA)
    const stored = readAccountState(ANA)
    if (stored.status !== 'ok') throw new Error('unreadable')
    const id = 'dddddddd-0000-4000-8000-000000000001'
    const state = { ...stored.state, order: [id], operations: [{ operationId: 'dddddddd-0000-4000-8000-000000000002', taskId: id, expectedVersion: 0, content: { text: 'From tab', completed: false, category: 'General', due: '' } }] }
    localStorage.setItem(ACCOUNT_PREFIX + ANA, JSON.stringify(state))
    await settle(() => window.dispatchEvent(new StorageEvent('storage', { key: ACCOUNT_PREFIX + ANA })))
    expect(texts()).toEqual(['From tab'])
  })

  it('never overwrites an unreadable account copy', async () => {
    localStorage.setItem(ACCOUNT_PREFIX + ANA, '{broken')
    const { client, restore } = fakeClient(new FakeAccount())
    restore(ANA)
    await open(client)
    await settle(() => hook().add('Lost?'))
    expect(hook().saveFailed).toBe(true)
    expect(localStorage.getItem(ACCOUNT_PREFIX + ANA)).toBe('{broken')
  })
})
