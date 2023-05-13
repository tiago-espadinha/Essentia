import type { SupabaseClient } from '@supabase/supabase-js'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { ACCOUNT_PREFIX, readAccountState } from '../data/syncStorage'
import { useTasks } from '../hooks/useTasks'
import { FakeAccount, fakeClient } from './fakeAccount'

const ANA = 'aaaaaaaa-0000-4000-8000-00000000000a'
const BEN = 'bbbbbbbb-0000-4000-8000-00000000000b'

/** Signs in or out, then lets the hook react. */
async function signInAs(account: ReturnType<typeof fakeClient>, id: string | null) {
  await settle(() => account.signIn(id))
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

  it('stores a due day given when the task is added', async () => {
    await open(fakeClient(new FakeAccount()).client)
    await settle(() => hook().add('Pay rent', '2023-06-01'))
    await settle(() => hook().add('Undated'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject([
      { text: 'Undated', due: '' },
      { text: 'Pay rent', due: '2023-06-01' },
    ])
  })

  it('syncs changes to another device on the same account', async () => {
    const server = new FakeAccount()
    const laptop = fakeClient(server)
    await open(laptop.client)
    await signInAs(laptop, ANA)
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
    const account = fakeClient(server)
    await open(account.client)
    await settle(() => hook().add('Mine'))
    await signInAs(account, ANA)
    expect(hook().unclaimed).toBe(1)
    expect(server.writes).toBe(0)

    await settle(() => hook().answer(true))
    expect(texts()).toEqual(['Mine'])
    expect(server.read(ANA)).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([])

    close()
    await open(account.client)
    expect(hook().unclaimed).toBe(0)
    expect(server.read(ANA)).toHaveLength(1)
  })

  it('keeps declined tasks on the device and shows them again once signed out', async () => {
    const server = new FakeAccount()
    const account = fakeClient(server)
    await open(account.client)
    await settle(() => hook().add('Private'))
    await signInAs(account, ANA)
    await settle(() => hook().answer(false))
    expect(texts()).toEqual([])
    expect(server.read(ANA)).toEqual([])

    close()
    await open(account.client)
    expect(hook().unclaimed).toBe(0)

    await signInAs(account, null)
    expect(texts()).toEqual(['Private'])
  })

  it('finishes a claim interrupted after the account’s copy was stored', async () => {
    const server = new FakeAccount()
    const account = fakeClient(server)
    await open(account.client)
    await settle(() => hook().add('Half done'))
    const legacy = localStorage.getItem(STORAGE_KEY)!
    await signInAs(account, ANA)
    await settle(() => hook().answer(true))
    close()
    // A crash between storing the account's copy and clearing the signed-out one.
    localStorage.setItem(STORAGE_KEY, legacy)

    await open(account.client)
    expect(hook().unclaimed).toBe(0)
    expect(texts()).toEqual(['Half done'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([])
    expect(server.read(ANA)).toHaveLength(1)
  })

  it('keeps changes made offline and sends them when back online', async () => {
    const server = new FakeAccount()
    const network: { down?: boolean } = {}
    const account = fakeClient(server, network)
    await open(account.client)
    await signInAs(account, ANA)
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
    const account = fakeClient(server)
    await open(account.client)
    await signInAs(account, ANA)
    await settle(() => hook().add('Ana’s'))
    await signInAs(account, BEN)
    expect(texts()).toEqual([])
    expect(hook().owner).toBe(BEN)
    expect(server.read(BEN)).toEqual([])
  })

  it('reports false while a conflict waits, so sign-out warns', async () => {
    const server = new FakeAccount()
    const other = fakeClient(server)
    const account = fakeClient(server)
    await open(account.client)
    await signInAs(account, ANA)
    await settle(() => hook().add('Plan'))
    const id = hook().tasks[0].id
    // Another device edits it first.
    other.restore(ANA)
    await other.client.rpc('acta_write_task', {
      p_owner: ANA, p_operation_id: 'cccccccc-0000-4000-8000-000000000002', p_task_id: id, p_expected_version: 1,
      p_content: { text: 'Theirs', completed: false, category: 'General', due: '' },
    })
    await settle(() => hook().update(id, { text: 'Mine', category: 'General', due: '', priority: 'none' }))
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
    const account = fakeClient(server)
    await open(account.client)
    await signInAs(account, ANA)
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
    const account = fakeClient(new FakeAccount())
    account.restore(ANA)
    await open(account.client)
    await settle(() => hook().add('Lost?'))
    expect(hook().saveFailed).toBe(true)
    expect(localStorage.getItem(ACCOUNT_PREFIX + ANA)).toBe('{broken')
  })
})

describe('when this device can’t store the account’s copy', () => {
  it('keeps every refused change on screen and sends none until one is stored', async () => {
    const server = new FakeAccount()
    const account = fakeClient(server)
    await open(account.client)
    await signInAs(account, ANA)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    await settle(() => hook().add('First'))
    await settle(() => hook().add('Second'))
    expect(texts()).toEqual(['Second', 'First'])
    expect(hook().saveFailed).toBe(true)
    expect(server.writes).toBe(0)

    setItem.mockRestore()
    await settle(() => hook().add('Third'))
    // Stored at last, all three go up with the next sync.
    expect(hook().saveFailed).toBe(false)
    expect(server.read(ANA)).toHaveLength(3)
    expect(texts()).toEqual(['Third', 'Second', 'First'])
  })
})

describe('signed-out tasks the account can’t hold', () => {
  it('leaves them on the device without asking about them again', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'long', text: 'x'.repeat(501), completed: false, category: 'General', due: '' },
      { id: 'ok', text: 'Fits', completed: false, category: 'General', due: '' },
    ]))
    const server = new FakeAccount()
    const account = fakeClient(server)
    await open(account.client)
    await signInAs(account, ANA)
    expect(hook().unclaimed).toBe(1)
    await settle(() => hook().answer(true))
    await signInAs(account, ANA)
    expect(hook().unclaimed).toBe(0)
    expect(server.read(ANA)).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject([{ id: 'long' }])
  })
})
