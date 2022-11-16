import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStamps, loadTransactions, save, SYNC_KEY, TRANSACTIONS_KEY } from './storage'
import { NO_STAMPS } from './sync'
import { createTransaction, type Transaction } from './transactions'

const tx: Transaction = createTransaction(
  { description: 'Coffee', amount: 350, type: 'expense', category: 'food', date: '2022-11-08' },
  new Date('2022-11-08T10:00:00Z'),
  'a',
)

const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('transaction storage', () => {
  it('starts empty when nothing is saved', () => {
    expect(loadTransactions()).toEqual([])
  })

  it('round-trips the transactions under the prefixed key', () => {
    expect(save(TRANSACTIONS_KEY, [tx])).toBe(true)
    expect(JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)!)).toEqual([tx])
    expect(loadTransactions()).toEqual([tx])
  })

  it('does not read the old finance app key', () => {
    store('finance_transactions', [tx])
    expect(loadTransactions()).toEqual([])
  })

  it('ignores corrupt or non-list data', () => {
    localStorage.setItem(TRANSACTIONS_KEY, '{not json')
    expect(loadTransactions()).toEqual([])
    store(TRANSACTIONS_KEY, { id: 'a' })
    expect(loadTransactions()).toEqual([])
  })

  it('skips malformed and repeated entries, keeps the valid ones and drops unknown fields', () => {
    store(TRANSACTIONS_KEY, [
      { ...tx, extra: '<script>', category: ' Food ' },
      { ...tx, description: 'Second copy' },
      { ...tx, id: 'b', amount: 3.5 },
      { ...tx, id: 'c', amount: -1 },
      { ...tx, id: 'd', type: 'transfer' },
      { ...tx, id: 'e', date: '2022-02-30' },
      { ...tx, id: 'f', updatedAt: 'yesterday' },
      null,
      { ...tx, id: 'g' },
    ])
    expect(loadTransactions()).toEqual([tx, { ...tx, id: 'g' }])
  })

  it('reports a refused write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(save(TRANSACTIONS_KEY, [tx])).toBe(false)
  })
})

describe('sync stamps', () => {
  it('round-trips the owner and pending deletions', () => {
    const stamps = { owner: 'ana', deleted: { a: '2022-11-08T10:00:00.000Z' } }
    save(SYNC_KEY, stamps)
    expect(loadStamps()).toEqual(stamps)
  })

  it('starts over from unreadable stamps', () => {
    expect(loadStamps()).toEqual(NO_STAMPS)
    localStorage.setItem(SYNC_KEY, 'nope')
    expect(loadStamps()).toEqual(NO_STAMPS)
    store(SYNC_KEY, { owner: 1, deleted: {} })
    expect(loadStamps()).toEqual(NO_STAMPS)
    store(SYNC_KEY, { owner: 'ana', deleted: { a: 'soon' } })
    expect(loadStamps()).toEqual(NO_STAMPS)
  })
})
