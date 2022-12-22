import type { SupabaseClient } from '@supabase/supabase-js'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { BUDGETS_KEY, SYNC_KEY, TRANSACTIONS_KEY } from './storage'
import './testing'
import type { TransactionFields } from './transactions'
import { useTransactions } from './useTransactions'

const rendered: { current: ReturnType<typeof useTransactions> | null } = { current: null }
const hook = () => rendered.current!
let root: Root
let container: HTMLElement

function Probe({ client }: { client: SupabaseClient | null }) {
  const value = useTransactions(client)
  useEffect(() => {
    rendered.current = value
  })
  return null
}

async function open(client: SupabaseClient | null) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  await settle(() => root.render(<Probe client={client} />))
}

function close() {
  act(() => root.unmount())
  container.remove()
}

const fields = (description: string, amount = 350): TransactionFields => ({
  description,
  amount,
  type: 'expense',
  category: 'food',
  date: '2022-11-08',
})

function add(description: string, amount?: number): string {
  let id = ''
  act(() => {
    id = hook().add(fields(description, amount)).id
  })
  return id
}

const descriptions = () => hook().transactions.map((t) => t.description)

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2022-11-08T09:00:00Z'))
})

afterEach(() => {
  if (container?.isConnected) close()
  vi.useRealTimers()
})

describe('syncing transactions with the account', () => {
  it('keeps nothing and syncs nothing while no one is signed in', async () => {
    const server = fakeServer()
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([{ id: 'x' }]))
    await open(server.client(null).client)
    expect(hook().transactions).toEqual([])
    expect(hook().syncState).toBe('off')
    expect(await hook().sync()).toBe(false)
  })

  it('reads the account on sign-in, then is ready', async () => {
    const server = fakeServer()
    const laptop = server.client({ user: { id: 'ana' } })
    await open(laptop.client)
    add('Coffee')
    await settle()
    close()

    localStorage.clear()
    const phone = server.client(null)
    await open(phone.client)
    expect(hook().ready).toBe(false)
    await phone.signInAs('ana')
    expect(hook().ready).toBe(true)
    expect(hook().syncState).toBe('synced')
    expect(descriptions()).toEqual(['Coffee'])
    expect(hook().transactions[0].amount).toBe(350)
  })

  it('is ready at once when the device already has the account’s transactions', async () => {
    const server = fakeServer()
    server.slow(5000)
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    expect(hook().ready).toBe(false)
    add('Coffee')
    expect(hook().ready).toBe(true)
  })

  it('stores amounts in euros and sends a burst of changes in one sync', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    const before = server.calls.upserts
    const id = add('Coffee', 350)
    act(() => hook().update(id, { amount: 1240 }))
    await settle()
    expect(server.calls.upserts).toBe(before + 1)
    expect(server.transactions).toMatchObject([{ description: 'Coffee', amount: 12.4, occurred_on: '2022-11-08', user_id: 'ana' }])

    await act(async () => {
      await hook().sync()
    })
    expect(server.calls.upserts).toBe(before + 1)
  })

  it('adds an import as one change and sends it in pages of a thousand', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    const before = server.calls.upserts
    act(() => hook().addAll(Array.from({ length: 1200 }, (_, i) => fields(`row ${i}`))))
    expect(hook().transactions).toHaveLength(1200)
    expect(new Set(hook().transactions.map((t) => t.id)).size).toBe(1200)
    await settle()
    expect(server.calls.upserts).toBe(before + 2)
    expect(server.transactions.filter((row) => row.user_id === 'ana')).toHaveLength(1200)
  })

  it('lists the newest day first', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    act(() => void hook().add({ ...fields('Older'), date: '2022-11-01' }))
    act(() => void hook().add({ ...fields('Newer'), date: '2022-11-07' }))
    act(() => void hook().add({ ...fields('Oldest'), date: '2022-10-30' }))
    expect(descriptions()).toEqual(['Newer', 'Older', 'Oldest'])
  })

  it('removes a transaction deleted on another device', async () => {
    const server = fakeServer()
    const laptop = server.client({ user: { id: 'ana' } })
    await open(laptop.client)
    const id = add('Rent')
    await settle()
    close()

    localStorage.clear()
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    vi.setSystemTime(new Date('2022-11-08T10:00:00Z'))
    act(() => hook().remove(id))
    await settle()
    expect(server.transactions[0].deleted_at).toBe('2022-11-08T10:00:00.000Z')
    close()

    localStorage.clear()
    await open(server.client({ user: { id: 'ana' } }).client)
    expect(hook().transactions).toEqual([])
  })

  it('puts back a deletion that already reached the account', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    const id = add('Rent')
    await settle()
    const removed = hook().transactions[0]
    vi.setSystemTime(new Date('2022-11-08T10:00:00Z'))
    act(() => hook().remove(id))
    await settle()
    vi.setSystemTime(new Date('2022-11-08T10:01:00Z'))
    act(() => hook().putBack(removed))
    await settle()
    expect(descriptions()).toEqual(['Rent'])
    expect(server.transactions[0].deleted_at).toBeNull()
  })

  it('keeps changes on the device when a sync fails, and sends them on retry', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.fail(true)
    add('Coffee')
    await settle()
    expect(hook().syncState).toBe('failed')
    expect(JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)!)).toHaveLength(1)

    server.fail(false)
    await act(async () => {
      expect(await hook().sync()).toBe(true)
    })
    expect(hook().syncState).toBe('synced')
    expect(server.transactions).toHaveLength(1)
  })

  it('syncs again when the page comes back online', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.fail(true)
    add('Coffee')
    await settle()
    server.fail(false)
    await settle(() => window.dispatchEvent(new Event('online')))
    expect(hook().syncState).toBe('synced')
  })

  it('clears the device on sign-out, and never shows one account’s transactions to another', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    add('Ana’s rent')
    await settle()

    await device.signInAs(null)
    expect(hook().transactions).toEqual([])
    expect(JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)!)).toEqual([])
    expect(JSON.parse(localStorage.getItem(SYNC_KEY)!)).toEqual({ owner: null, deleted: {} })

    await device.signInAs('ben')
    expect(hook().transactions).toEqual([])
    expect(server.transactions.map((row) => row.user_id)).toEqual(['ana'])
  })

  it('drops another account’s copy left on the device when a new account signs in', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    add('Ana’s rent')
    await settle()
    // Another tab switches accounts while this one is closed.
    close()
    await open(server.client({ user: { id: 'ben' } }).client)
    expect(hook().transactions).toEqual([])
    expect(server.transactions.map((row) => row.user_id)).toEqual(['ana'])
  })

  it('discards a sync answer that arrives after signing out', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    add('Coffee')
    await settle()
    close()

    localStorage.clear()
    server.slow(1000)
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    phone.emit(null)
    await settle()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(hook().transactions).toEqual([])
    expect(hook().syncState).toBe('off')
  })

  it('runs a sync asked for during an account switch', async () => {
    const server = fakeServer()
    server.slow(1000)
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    device.emit('ben')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    add('Ben’s coffee')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(server.transactions.map((row) => [row.description, row.user_id])).toEqual([['Ben’s coffee', 'ben']])
    expect(hook().syncState).toBe('synced')
  })

  it('says when the device refuses to save', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    add('Coffee')
    expect(hook().saveFailed).toBe(true)
    vi.restoreAllMocks()
  })
  it('runs the new account’s sync when the switch lands while a push is out', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.slow(1000)
    add('Ana’s coffee')
    // The deferred sync starts, fetches, and is pushing when Ben signs in elsewhere.
    await act(() => vi.advanceTimersByTimeAsync(2000 + 1500))
    device.emit('ben')
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(hook().syncState).toBe('synced')
    expect(hook().ready).toBe(true)
  })

  it('never writes one account’s rows under another’s session', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.slow(1000)
    add('Ana’s coffee')
    // Ben signs in after Ana's sync fetched, before its push goes out.
    await act(() => vi.advanceTimersByTimeAsync(2000 + 1000))
    device.emit('ben')
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(server.transactions.filter((row) => row.user_id === 'ben')).toEqual([])
  })

  it('reads an account longer than one page', async () => {
    const server = fakeServer()
    for (let i = 0; i < 1001; i++) {
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`
      server.transactions.push({ id, user_id: 'ana', description: `t${i}`, amount: 1, type: 'expense', category: 'other', occurred_on: '2022-11-08', created_at: '2022-11-08T08:00:00Z', updated_at: '2022-11-08T08:00:00Z', deleted_at: null })
    }
    await open(server.client({ user: { id: 'ana' } }).client)
    expect(hook().transactions).toHaveLength(1001)
  })

  it('does not list a transaction twice when an undo follows a sync that brought it back', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    const id = add('Rent')
    const removed = hook().transactions[0]
    act(() => hook().remove(id))
    act(() => hook().putBack(removed))
    act(() => hook().putBack(removed))
    expect(descriptions()).toEqual(['Rent'])
  })
})

describe('syncing budgets with the account', () => {
  const budgets = () => hook().budgets.map(({ category, amount }) => ({ category, amount }))

  it('follows the account to another device, one per category', async () => {
    const server = fakeServer()
    const laptop = server.client({ user: { id: 'ana' } })
    await open(laptop.client)
    act(() => hook().setBudget('Food', 20000))
    act(() => hook().setBudget('transport', 5000))
    act(() => hook().setBudget('food', 25000))
    await settle()
    expect(server.budgets).toMatchObject([
      { category: 'food', amount: 250, user_id: 'ana' },
      { category: 'transport', amount: 50, user_id: 'ana' },
    ])
    close()

    localStorage.clear()
    const phone = server.client(null)
    await open(phone.client)
    await phone.signInAs('ana')
    expect(budgets()).toEqual([
      { category: 'food', amount: 25000 },
      { category: 'transport', amount: 5000 },
    ])
  })

  it('removes a budget on every device', async () => {
    const server = fakeServer()
    const laptop = server.client({ user: { id: 'ana' } })
    await open(laptop.client)
    act(() => hook().setBudget('food', 20000))
    await settle()
    close()

    const phone = server.client({ user: { id: 'ana' } })
    localStorage.clear()
    await open(phone.client)
    vi.advanceTimersByTime(60_000)
    act(() => hook().removeBudget('food'))
    await settle()
    expect(server.budgets[0].deleted_at).not.toBeNull()
    close()

    localStorage.clear()
    await open(laptop.client)
    expect(budgets()).toEqual([])
  })

  it('never gives one account’s budgets to another that signs in on the device', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    act(() => hook().setBudget('food', 20000))
    expect(hook().budgetsReady).toBe(true)
    await settle()
    await device.signInAs('ben')
    expect(hook().budgets).toEqual([])
    expect(server.budgets.map((row) => row.user_id)).toEqual(['ana'])
  })

  it('clears the budgets from the device on sign-out', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    act(() => hook().setBudget('food', 20000))
    await settle()
    await device.signInAs(null)
    expect(hook().budgets).toEqual([])
    expect(localStorage.getItem(BUDGETS_KEY)).toBe(JSON.stringify({ budgets: [], deleted: {} }))
  })
})
