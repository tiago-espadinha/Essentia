import { describe, expect, it } from 'vitest'
import {
  applyChanges,
  byDate,
  cleanCategory,
  createTransaction,
  dayKey,
  isDay,
  monthLabel,
  monthOf,
  newId,
  shortDate,
  totals,
  type Transaction,
} from './transactions'

const tx = (id: string, fields: Partial<Transaction> = {}): Transaction => ({
  ...createTransaction(
    { description: id, amount: 100, type: 'expense', category: 'other', date: '2022-11-03' },
    new Date('2022-11-03T10:00:00Z'),
    id,
  ),
  ...fields,
})

describe('createTransaction and applyChanges', () => {
  it('stamps a new transaction with its creation time', () => {
    const fields = { description: 'Coffee', amount: 350, type: 'expense', category: 'food', date: '2022-11-03' } as const
    expect(createTransaction(fields, new Date('2022-11-03T09:30:00Z'), 'a')).toEqual({
      id: 'a',
      ...fields,
      createdAt: '2022-11-03T09:30:00.000Z',
      updatedAt: '2022-11-03T09:30:00.000Z',
    })
  })

  it('changes fields and moves only updatedAt', () => {
    const before = tx('a')
    const after = applyChanges(before, { amount: 990 }, new Date('2022-11-04T08:00:00Z'))
    expect(after).toEqual({ ...before, amount: 990, updatedAt: '2022-11-04T08:00:00.000Z' })
  })

  it('makes version 4 uuids', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('days', () => {
  it('keys a moment by the local day, not the UTC one', () => {
    // Tests run in Pacific/Auckland: 20:00 UTC on Nov 2 is already Nov 3 there.
    expect(dayKey(new Date('2022-11-02T20:00:00Z'))).toBe('2022-11-03')
  })

  it('accepts real calendar days only', () => {
    expect(isDay('2022-11-03')).toBe(true)
    expect(isDay('2024-02-29')).toBe(true)
    expect(isDay('2022-02-29')).toBe(false)
    expect(isDay('2022-13-01')).toBe(false)
    expect(isDay('2022-11-3')).toBe(false)
    expect(isDay('')).toBe(false)
  })

  it('names months and days', () => {
    expect(monthOf('2022-11-03')).toBe('2022-11')
    expect(monthLabel('2022-11')).toBe('November 2022')
    expect(shortDate('2022-11-03')).toBe('Nov 3')
  })
})

describe('cleanCategory', () => {
  it('trims, lowercases and falls back to other', () => {
    expect(cleanCategory('  Eating   Out ')).toBe('eating out')
    expect(cleanCategory('   ')).toBe('other')
  })
})

describe('byDate', () => {
  it('puts the newest day first, then the one added last', () => {
    const list = [
      tx('old', { date: '2022-11-01' }),
      tx('first', { createdAt: '2022-11-03T08:00:00.000Z' }),
      tx('second', { createdAt: '2022-11-03T09:00:00.000Z' }),
      tx('new', { date: '2022-11-05' }),
    ]
    expect(list.sort(byDate).map((t) => t.id)).toEqual(['new', 'second', 'first', 'old'])
  })
})

describe('totals', () => {
  it('sums income and expenses in cents, without float drift', () => {
    const list = [
      tx('a', { type: 'income', amount: 210_000 }),
      ...Array.from({ length: 10 }, (_, i) => tx(`c${i}`, { amount: 10 })),
      tx('b', { amount: 20 }),
    ]
    expect(totals(list)).toEqual({ income: 210_000, expenses: 120, balance: 209_880 })
  })

  it('goes negative when more went out', () => {
    expect(totals([tx('a', { amount: 500 })]).balance).toBe(-500)
    expect(totals([])).toEqual({ income: 0, expenses: 0, balance: 0 })
  })
})
