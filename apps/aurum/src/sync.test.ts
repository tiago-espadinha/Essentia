import { describe, expect, it } from 'vitest'
import { MAX_CENTS } from './money'
import { merge, NO_STAMPS, readRemote, stampDeletions, syncable, type Stamps, type TransactionRow } from './sync'
import { createTransaction, type Transaction } from './transactions'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const T1 = '2022-11-08T10:00:00.000Z'
const T2 = '2022-11-08T11:00:00.000Z'
const T3 = '2022-11-08T12:00:00.000Z'

function tx(changes: Partial<Transaction> = {}): Transaction {
  return {
    ...createTransaction({ description: 'Coffee', amount: 350, type: 'expense', category: 'food', date: '2022-11-08' }, new Date(T1), ID),
    ...changes,
  }
}

function row(changes: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: ID,
    description: 'Coffee',
    amount: 3.5,
    type: 'expense',
    category: 'food',
    occurred_on: '2022-11-08',
    created_at: T1,
    updated_at: T1,
    deleted_at: null,
    ...changes,
  }
}

const stamps = (deleted: Record<string, string> = {}): Stamps => ({ owner: 'ana', deleted })

describe('merge', () => {
  it('uploads transactions the account does not have yet, in euros', () => {
    const local = tx()
    const result = merge([local], stamps(), [])
    expect(result.transactions).toEqual([local])
    expect(result.push.rows).toEqual([row()])
  })

  it('adds the account’s transactions this device does not have, in cents', () => {
    const result = merge([], stamps(), [row({ amount: 12.4, updated_at: '2022-11-08T12:00:00+00:00' })])
    expect(result.transactions).toEqual([tx({ amount: 1240, updatedAt: T3 })])
    expect(result.push).toEqual({ rows: [], deletions: [] })
  })

  it('keeps the newer side of a transaction changed on both', () => {
    const newerHere = merge([tx({ amount: 400, updatedAt: T3 })], stamps(), [row({ amount: 5, updated_at: T2 })])
    expect(newerHere.transactions[0].amount).toBe(400)
    expect(newerHere.push.rows.map((r) => r.amount)).toEqual([4])

    const newerThere = merge([tx({ amount: 400, updatedAt: T2 })], stamps(), [row({ amount: 5, occurred_on: '2022-11-01', updated_at: T3 })])
    expect(newerThere.transactions[0]).toMatchObject({ amount: 500, date: '2022-11-01' })
    expect(newerThere.push.rows).toEqual([])
  })

  it('sends nothing once both sides match', () => {
    const first = merge([tx({ updatedAt: T2 })], stamps(), [])
    const again = merge(first.transactions, first.stamps, first.push.rows)
    expect(again.push).toEqual({ rows: [], deletions: [] })
    expect(again.transactions).toEqual(first.transactions)
  })

  it('drops a transaction deleted elsewhere after this device last changed it', () => {
    const result = merge([tx({ updatedAt: T1 })], stamps(), [row({ updated_at: T2, deleted_at: T2 })])
    expect(result.transactions).toEqual([])
    expect(result.push.rows).toEqual([])
  })

  it('brings a transaction back when it was edited here after being deleted elsewhere', () => {
    const result = merge([tx({ description: 'kept', updatedAt: T3 })], stamps(), [row({ updated_at: T2, deleted_at: T2 })])
    expect(result.transactions.map((t) => t.description)).toEqual(['kept'])
    expect(result.push.rows).toEqual([row({ description: 'kept', updated_at: T3 })])
  })

  it('tells the server about a deletion, and forgets it once the server has it', () => {
    const first = merge([], stamps({ [ID]: T2 }), [row({ updated_at: T1 })])
    expect(first.transactions).toEqual([])
    expect(first.push.deletions).toEqual([{ id: ID, at: T2 }])
    expect(first.stamps.deleted).toEqual({ [ID]: T2 })

    const again = merge([], first.stamps, [row({ updated_at: T2, deleted_at: T2 })])
    expect(again.push).toEqual({ rows: [], deletions: [] })
    expect(again.stamps.deleted).toEqual({})
  })

  it('brings back a transaction deleted here when the account has a newer edit', () => {
    const result = merge([], stamps({ [ID]: T2 }), [row({ description: 'edited there', updated_at: T3 })])
    expect(result.transactions.map((t) => t.description)).toEqual(['edited there'])
    expect(result.push.deletions).toEqual([])
    expect(result.stamps.deleted).toEqual({})
  })

  it('does not send a deletion the server already has, and forgets one it never heard of', () => {
    const known = merge([], stamps({ [ID]: T3 }), [row({ updated_at: T2, deleted_at: T2 })])
    expect(known.push.deletions).toEqual([])
    expect(known.stamps.deleted).toEqual({})
    const unknown = merge([], stamps({ [ID]: T2 }), [])
    expect(unknown.push).toEqual({ rows: [], deletions: [] })
    expect(unknown.stamps.deleted).toEqual({})
  })

  it('keeps transactions the table cannot hold on this device only', () => {
    const local = [tx({ id: 'old-id' }), tx({ id: OTHER, description: 'x'.repeat(201) })]
    const result = merge(local, stamps(), [])
    expect(result.transactions).toEqual(local)
    expect(result.push.rows).toEqual([])
  })
})

describe('syncable', () => {
  it('matches the table checks', () => {
    expect(syncable(tx())).toBe(true)
    expect(syncable(tx({ amount: MAX_CENTS }))).toBe(true)
    expect(syncable(tx({ amount: MAX_CENTS + 1 }))).toBe(false)
    expect(syncable(tx({ amount: 3.5 }))).toBe(false)
    expect(syncable(tx({ description: '' }))).toBe(false)
    expect(syncable(tx({ category: 'c'.repeat(41) }))).toBe(false)
    expect(syncable(tx({ date: '2022-02-30' }))).toBe(false)
  })
})

describe('readRemote', () => {
  it('keeps well-formed rows, reads string amounts and tidies the category', () => {
    expect(readRemote([row({ amount: '12.40' as unknown as number, category: ' Eating Out ' })])).toEqual([
      row({ amount: 12.4, category: 'eating out' }),
    ])
  })

  it('drops rows it cannot trust', () => {
    const bad = [
      null,
      'row',
      row({ id: 'not-a-uuid' }),
      row({ description: '' }),
      { ...row(), description: 1 },
      row({ amount: 0 }),
      row({ amount: -2 }),
      { ...row(), amount: 'lots' },
      { ...row(), type: 'transfer' },
      row({ occurred_on: '2022-13-01' }),
      row({ updated_at: 'yesterday' }),
      row({ deleted_at: 'gone' }),
    ]
    expect(readRemote(bad)).toEqual([])
  })
})

describe('stampDeletions', () => {
  it('stamps transactions that a change removed', () => {
    const a = tx()
    const b = tx({ id: OTHER })
    expect(stampDeletions([a, b], [a], stamps(), T2).deleted).toEqual({ [OTHER]: T2 })
  })

  it('drops the stamp of a transaction put back', () => {
    expect(stampDeletions([], [tx()], stamps({ [ID]: T2 }), T3)).toEqual({ owner: 'ana', deleted: {} })
  })

  it('leaves the owner alone', () => {
    expect(stampDeletions([], [], NO_STAMPS, T2)).toEqual(NO_STAMPS)
  })
})
