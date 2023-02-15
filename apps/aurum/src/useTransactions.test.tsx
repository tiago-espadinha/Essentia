import type { SupabaseClient } from '@supabase/supabase-js'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import type { RecurringFields } from './recurring'
import { BUDGETS_KEY, RECURRING_KEY, SYNC_KEY, TRANSACTIONS_KEY } from './storage'
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

const idOf = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`

/** A transaction row as the account holds it, 3.50 euros on the test day. */
const remoteRow = (n: number, user: string, description: string, changes: Record<string, unknown> = {}) => ({
  id: idOf(n),
  user_id: user,
  description,
  amount: 3.5,
  type: 'expense',
  category: 'food',
  occurred_on: '2022-11-08',
  created_at: '2022-11-08T08:00:00Z',
  updated_at: '2022-11-08T08:00:00Z',
  deleted_at: null,
  ...changes,
})

/** The same transaction as this device saves it. */
const localCopy = (n: number, description: string, updatedAt = '2022-11-08T08:00:00.000Z') => ({
  id: idOf(n),
  description,
  amount: 350,
  type: 'expense',
  category: 'food',
  date: '2022-11-08',
  createdAt: '2022-11-08T08:00:00.000Z',
  updatedAt,
})

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2022-11-08T09:00:00Z'))
})

afterEach(() => {
  if (container?.isConnected) close()
  vi.useRealTimers()
  vi.restoreAllMocks()
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
    // Slower than the time `open` waits, so the sync is still out when the account signs out.
    server.slow(5000)
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    expect(hook().syncState).toBe('syncing')
    const before = JSON.stringify(server.transactions)
    phone.emit(null)
    await settle()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(hook().transactions).toEqual([])
    expect(hook().syncState).toBe('off')
    expect(JSON.stringify(server.transactions)).toBe(before)
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
  })

  it('runs the new account’s sync when the switch lands while a push is out', async () => {
    const server = fakeServer()
    server.transactions.push(remoteRow(1, 'ben', 'Ben’s rent'))
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
    expect(descriptions()).toEqual(['Ben’s rent'])
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
    expect(server.transactions.filter((row) => row.user_id === 'ana').map((row) => row.description)).toEqual(['Ana’s coffee'])
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
    await settle()
    const removed = hook().transactions[0]
    // Another device edited it after this device's deletion, so the sync brings it back.
    server.transactions[0].updated_at = '2022-11-08T12:00:00.000Z'
    act(() => hook().remove(id))
    expect(descriptions()).toEqual([])
    await act(async () => {
      expect(await hook().sync()).toBe(true)
    })
    expect(descriptions()).toEqual(['Rent'])
    act(() => hook().putBack(removed))
    expect(descriptions()).toEqual(['Rent'])
  })

  it('keeps everything and retries what is outstanding when the push fails partway', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.failTable('transactions')
    act(() => hook().setBudget('food', 20000))
    add('Coffee')
    await settle()
    expect(hook().syncState).toBe('failed')
    expect(server.budgets).toHaveLength(1)
    expect(server.transactions).toEqual([])
    expect(descriptions()).toEqual(['Coffee'])
    expect(hook().budgets).toMatchObject([{ category: 'food', amount: 20000 }])
    expect(JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)!)).toHaveLength(1)

    server.failTable(null)
    await act(async () => {
      expect(await hook().sync()).toBe(true)
    })
    expect(hook().syncState).toBe('synced')
    expect(server.transactions.map((row) => row.description)).toEqual(['Coffee'])
    expect(server.budgets).toHaveLength(1)
    expect(descriptions()).toEqual(['Coffee'])
  })

  it('still deletes on the account after a reload, when the device was offline for the deletion', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    const id = add('Rent')
    await settle()
    expect(server.transactions[0].deleted_at).toBeNull()

    server.fail(true)
    vi.setSystemTime(new Date('2022-11-08T10:00:00Z'))
    act(() => hook().remove(id))
    await settle()
    expect(hook().syncState).toBe('failed')
    expect(JSON.parse(localStorage.getItem(SYNC_KEY)!).deleted).toHaveProperty(id)
    close()

    // The device is reopened as it was left, with the account reachable again.
    server.fail(false)
    await open(server.client({ user: { id: 'ana' } }).client)
    expect(hook().transactions).toEqual([])
    expect(server.transactions[0].deleted_at).toBe('2022-11-08T10:00:00.000Z')
    // The note of the deletion goes once a later sync sees it on the account.
    await act(async () => {
      expect(await hook().sync()).toBe(true)
    })
    expect(JSON.parse(localStorage.getItem(SYNC_KEY)!).deleted).toEqual({})
  })

  it('answers every sync asked for at once, and sends an edit made meanwhile', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.slow(100)
    const requests = { upserts: server.calls.upserts, posts: server.calls.posts }
    let results: boolean[] = []
    await act(async () => {
      const first = [hook().sync(), hook().sync()]
      // The first run has fetched and is posting recurring items when the edit lands.
      await vi.advanceTimersByTimeAsync(150)
      hook().add(fields('Coffee'))
      const later = [hook().sync(), hook().sync(), hook().sync()]
      await vi.advanceTimersByTimeAsync(1000)
      results = await Promise.all([...first, ...later])
    })
    expect(results).toEqual([true, true, true, true, true])
    expect(server.transactions.map((row) => row.description)).toEqual(['Coffee'])
    expect(hook().syncState).toBe('synced')
    // One run, and one more for the edit: not one per call.
    expect(server.calls.upserts - requests.upserts).toBe(1)
    expect(server.calls.posts - requests.posts).toBe(2)
  })

  it('merges an account that already holds data: the newer side wins, bad rows are skipped', async () => {
    const server = fakeServer()
    server.transactions.push(
      remoteRow(1, 'ana', 'Server version', { updated_at: '2022-11-08T08:30:00Z' }),
      remoteRow(2, 'ana', 'Old on server'),
      remoteRow(3, 'ana', 'Bad amount', { amount: 'abc' }),
      remoteRow(4, 'ana', 'Bad id', { id: 'not-an-id' }),
      remoteRow(5, 'ana', 'Deleted elsewhere', { deleted_at: '2022-11-08T08:10:00Z', updated_at: '2022-11-08T08:10:00Z' }),
      remoteRow(6, 'ana', 'Only on the account'),
    )
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: 'ana', deleted: {} }))
    localStorage.setItem(
      TRANSACTIONS_KEY,
      JSON.stringify([localCopy(1, 'Local version'), localCopy(2, 'Local edit', '2022-11-08T08:30:00.000Z')]),
    )
    await open(server.client({ user: { id: 'ana' } }).client)
    expect(hook().syncState).toBe('synced')
    expect(descriptions().sort()).toEqual(['Local edit', 'Only on the account', 'Server version'])
    const stored = (n: number) => server.transactions.find((row) => row.id === idOf(n))
    expect(stored(1)).toMatchObject({ description: 'Server version' })
    expect(stored(2)).toMatchObject({ description: 'Local edit', updated_at: '2022-11-08T08:30:00.000Z' })
    expect(stored(3)).toMatchObject({ amount: 'abc' })
    expect(server.transactions).toHaveLength(6)
  })

  it('syncs when the page becomes visible again, not when it is hidden', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.fail(true)
    add('Coffee')
    await settle()
    expect(hook().syncState).toBe('failed')
    server.fail(false)

    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('hidden')
    await settle(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(hook().syncState).toBe('failed')
    expect(server.transactions).toEqual([])

    visibility.mockReturnValue('visible')
    await settle(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(hook().syncState).toBe('synced')
    expect(server.transactions).toHaveLength(1)
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
    vi.setSystemTime(new Date('2022-11-08T10:00:00Z'))
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
    expect(hook().planReady).toBe(true)
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

describe('recurring items', () => {
  const rent = (changes: Partial<RecurringFields> = {}): RecurringFields => ({
    description: 'Rent',
    amount: 90000,
    type: 'expense',
    category: 'housing',
    frequency: 'monthly',
    startOn: '2022-08-31',
    ...changes,
  })
  const posted = () => hook().transactions.filter((t) => t.description === 'Rent').map((t) => t.date)

  it('catches up every period missed, month ends included, once', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    act(() => hook().addRecurring(rent()))
    await settle()
    expect(posted()).toEqual(['2022-10-31', '2022-09-30', '2022-08-31'])
    expect(hook().transactions[0]).toMatchObject({ amount: 90000, type: 'expense', category: 'housing' })
    expect(server.recurring).toMatchObject([{ description: 'Rent', amount: 900, start_on: '2022-08-31', user_id: 'ana' }])

    await act(async () => {
      await hook().sync()
    })
    expect(posted()).toHaveLength(3)
  })

  it('posts a Jan 31 monthly item on Feb 28, using the device’s own day', async () => {
    vi.setSystemTime(new Date(2023, 2, 1, 0, 30))
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    act(() => hook().addRecurring(rent({ startOn: '2023-01-31' })))
    await settle()
    expect(posted()).toEqual(['2023-02-28', '2023-01-31'])
  })

  it('posts nothing while paused, and resumes from the day it is resumed', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    act(() => hook().addRecurring(rent({ frequency: 'weekly', startOn: '2022-11-10' })))
    await settle()
    const id = hook().recurring[0].id
    act(() => hook().setRecurringPaused(id, true))
    await settle()
    expect(hook().recurring[0].paused).toBe(true)

    vi.setSystemTime(new Date('2022-12-01T09:00:00Z'))
    await act(async () => {
      await hook().sync()
    })
    expect(posted()).toEqual([])

    act(() => hook().setRecurringPaused(id, false))
    await settle()
    expect(hook().recurring[0].resumedOn).toBe('2022-12-01')
    expect(posted()).toEqual(['2022-12-01'])
  })

  it('still posts what fell due before a pause, even when it had not synced yet', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    server.fail(true)
    await open(device.client)
    act(() => hook().addRecurring(rent({ startOn: '2022-11-01' })))
    act(() => hook().setRecurringPaused(hook().recurring[0].id, true))
    server.fail(false)
    await act(async () => {
      await hook().sync()
    })
    expect(posted()).toEqual(['2022-11-01'])
  })

  it('follows the account to another device, and a deletion stops it there', async () => {
    const server = fakeServer()
    const laptop = server.client({ user: { id: 'ana' } })
    await open(laptop.client)
    act(() => hook().addRecurring(rent({ startOn: '2022-12-01' })))
    await settle()
    close()

    localStorage.clear()
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    expect(hook().recurring.map((item) => item.description)).toEqual(['Rent'])
    vi.setSystemTime(new Date('2022-11-08T10:00:00Z'))
    act(() => hook().removeRecurring(hook().recurring[0].id))
    await settle()
    expect(server.recurring[0].deleted_at).not.toBeNull()

    vi.setSystemTime(new Date('2022-12-02T09:00:00Z'))
    await act(async () => {
      await hook().sync()
    })
    expect(posted()).toEqual([])
  })

  it('brings paused and running items to another device, with the day each was paused', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    act(() => hook().addRecurring(rent({ startOn: '2022-12-01' })))
    act(() => hook().addRecurring(rent({ description: 'Gym', amount: 3000, startOn: '2022-12-05' })))
    act(() => hook().setRecurringPaused(hook().recurring.find((item) => item.description === 'Gym')!.id, true))
    await settle()
    close()

    localStorage.clear()
    await open(server.client({ user: { id: 'ana' } }).client)
    const byName = Object.fromEntries(hook().recurring.map((item) => [item.description, item]))
    expect(byName.Rent).toMatchObject({ paused: false, pausedOn: null })
    expect(byName.Gym).toMatchObject({ paused: true, pausedOn: '2022-11-08' })
  })

  it('clears the recurring items from the device on sign-out', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    act(() => hook().addRecurring(rent({ startOn: '2022-12-01' })))
    await settle()
    await device.signInAs(null)
    expect(hook().recurring).toEqual([])
    expect(localStorage.getItem(RECURRING_KEY)).toBe(JSON.stringify({ items: [], deleted: {} }))
  })

  it('fails the sync when the account cannot post what fell due, and posts it once it can', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.failRpc(true)
    act(() => hook().addRecurring(rent()))
    add('Coffee')
    await settle()
    expect(hook().syncState).toBe('failed')
    expect(hook().recurring.map((item) => item.description)).toEqual(['Rent'])
    expect(descriptions()).toEqual(['Coffee'])
    await act(async () => {
      expect(await hook().sync()).toBe(false)
    })

    server.failRpc(false)
    await act(async () => {
      expect(await hook().sync()).toBe(true)
    })
    expect(hook().syncState).toBe('synced')
    expect(posted()).toEqual(['2022-10-31', '2022-09-30', '2022-08-31'])
    expect(server.recurring).toHaveLength(1)
    expect(server.transactions.filter((row) => row.description === 'Rent')).toHaveLength(3)
  })
})

describe('saved data on the device', () => {
  const signedInAsAna = () => localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: 'ana', deleted: {} }))

  it('skips what is unreadable or repeated when it opens', async () => {
    signedInAsAna()
    localStorage.setItem(
      TRANSACTIONS_KEY,
      JSON.stringify([null, 'text', { id: 'x' }, localCopy(1, 'Kept'), localCopy(1, 'Repeated'), { ...localCopy(2, 'No amount'), amount: -5 }, localCopy(3, 'Also kept')]),
    )
    const stamp = '2022-11-08T08:00:00.000Z'
    localStorage.setItem(
      BUDGETS_KEY,
      JSON.stringify({
        budgets: [{ category: 'food', amount: 20000, updatedAt: stamp }, null, { category: 5 }, { category: 'food', amount: 999, updatedAt: stamp }, { category: 'fun', amount: 0, updatedAt: stamp }],
        deleted: {},
      }),
    )
    localStorage.setItem(RECURRING_KEY, '{not json')
    await open(null)
    expect(descriptions().sort()).toEqual(['Also kept', 'Kept'])
    expect(hook().budgets).toMatchObject([{ category: 'food', amount: 20000 }])
    expect(hook().recurring).toEqual([])
  })

  it('starts over from data that is not a list at all', async () => {
    signedInAsAna()
    localStorage.setItem(TRANSACTIONS_KEY, '{"a":1}')
    localStorage.setItem(BUDGETS_KEY, '[1,2]')
    localStorage.setItem(RECURRING_KEY, JSON.stringify({ items: [{ id: 5 }], deleted: { x: 'not a date' } }))
    await open(null)
    expect(hook().transactions).toEqual([])
    expect(hook().budgets).toEqual([])
    expect(hook().recurring).toEqual([])
  })

  it('reports a refused write for the budgets alone, until the next one succeeds', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    const setItem = Storage.prototype.setItem
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === BUDGETS_KEY) throw new DOMException('full', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    add('Coffee')
    expect(hook().saveFailed).toBe(false)
    act(() => hook().setBudget('food', 20000))
    expect(hook().saveFailed).toBe(true)
    // Another key saving fine does not clear it.
    add('Tea')
    expect(hook().saveFailed).toBe(true)

    refuse.mockRestore()
    act(() => hook().setBudget('food', 25000))
    expect(hook().saveFailed).toBe(false)
  })
})
