import { describe, expect, it } from 'vitest'
import { addDays, addMonths, periodTotals, spendingByCategory, weekOf } from '../domain/insights'
import { createTransaction, type Transaction, type TransactionFields } from '../domain/transactions'

const tx = (fields: Partial<TransactionFields>): Transaction =>
  createTransaction(
    { description: 'item', amount: 100, type: 'expense', category: 'other', date: '2022-11-03', ...fields },
    new Date('2022-11-03T10:00:00Z'),
  )

describe('addMonths', () => {
  it('moves across year ends both ways', () => {
    expect(addMonths('2022-01', -1)).toBe('2021-12')
    expect(addMonths('2022-12', 1)).toBe('2023-01')
    expect(addMonths('2022-11', -5)).toBe('2022-06')
    expect(addMonths('2022-11', 0)).toBe('2022-11')
  })
})

describe('weekOf', () => {
  it('goes back to the Monday, across month and year ends', () => {
    expect(weekOf('2023-04-24')).toBe('2023-04-24')
    expect(weekOf('2023-04-30')).toBe('2023-04-24')
    expect(weekOf('2023-05-01')).toBe('2023-05-01')
    expect(weekOf('2023-01-01')).toBe('2022-12-26')
    expect(weekOf('2023-03-26')).toBe('2023-03-20')
  })
})

describe('addDays', () => {
  it('moves by whole days across a leap day and a year end', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2023-01-02', -7)).toBe('2022-12-26')
  })
})

describe('periodTotals', () => {
  const list = [
    tx({ amount: 210000, type: 'income', category: 'salary', date: '2022-11-01' }),
    tx({ amount: 350, date: '2022-11-30' }),
    tx({ amount: 1250, date: '2022-10-31' }),
    tx({ amount: 999, date: '2022-12-01' }),
    tx({ amount: 500, date: '2021-11-15' }),
  ]

  it('sums each of the last six months to the cent, oldest first, with empty months as zero', () => {
    const months = periodTotals(list, 'months', '2022-11-08')
    expect(months.map((m) => m.period)).toEqual(['2022-06', '2022-07', '2022-08', '2022-09', '2022-10', '2022-11'])
    expect(months.slice(3)).toEqual([
      { period: '2022-09', income: 0, expenses: 0, balance: 0 },
      { period: '2022-10', income: 0, expenses: 1250, balance: -1250 },
      { period: '2022-11', income: 210000, expenses: 350, balance: 209650 },
    ])
    expect(months.some((m) => m.expenses === 999)).toBe(false)
  })

  it('reaches a year back over twelve months, leaving out the same month a year earlier', () => {
    const months = periodTotals(list, 'year', '2022-11-30')
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ period: '2021-12', income: 0, expenses: 0, balance: 0 })
    expect(months.reduce((sum, m) => sum + m.expenses, 0)).toBe(1600)
  })

  it('counts twelve Monday-first weeks, the first and last day of each inside it', () => {
    const weeks = periodTotals(
      [
        tx({ amount: 100, date: '2023-04-24' }), // Monday of the last week
        tx({ amount: 200, date: '2023-04-30' }), // its Sunday
        tx({ amount: 300, date: '2023-04-23' }), // Sunday of the week before
        tx({ amount: 400, type: 'income', date: '2023-02-06' }), // Monday of the first week
        tx({ amount: 500, date: '2023-02-05' }), // the day before the interval
        tx({ amount: 600, date: '2023-05-01' }), // the day after it
      ],
      'weeks',
      '2023-04-30',
    )
    expect(weeks).toHaveLength(12)
    expect(weeks[0]).toEqual({ period: '2023-02-06', income: 400, expenses: 0, balance: 400 })
    expect(weeks[10]).toEqual({ period: '2023-04-17', income: 0, expenses: 300, balance: -300 })
    expect(weeks[11]).toEqual({ period: '2023-04-24', income: 0, expenses: 300, balance: -300 })
    expect(weeks.reduce((sum, w) => sum + w.expenses, 0)).toBe(600)
  })

  it('gives zero buckets when nothing falls in the interval', () => {
    const weeks = periodTotals(list, 'weeks', '2023-04-30')
    expect(weeks.every((w) => w.income === 0 && w.expenses === 0)).toBe(true)
  })
})

describe('spendingByCategory', () => {
  const list = [
    tx({ amount: 3000, category: 'food', date: '2022-11-02' }),
    tx({ amount: 1000, category: 'food', date: '2022-11-09' }),
    tx({ amount: 4000, category: 'housing', date: '2022-11-01' }),
    tx({ amount: 2000, category: 'transport', date: '2022-10-12' }),
    tx({ amount: 9000, type: 'income', category: 'salary', date: '2022-11-01' }),
  ]

  it('adds up expenses only, largest first, with ties in name order', () => {
    expect(spendingByCategory(list, '2022-11')).toEqual([
      { category: 'food', amount: 4000, share: 0.5 },
      { category: 'housing', amount: 4000, share: 0.5 },
    ])
    expect(spendingByCategory(list, '2022-10')).toEqual([{ category: 'transport', amount: 2000, share: 1 }])
  })

  it('is empty for a month with no expenses', () => {
    expect(spendingByCategory(list, '2022-09')).toEqual([])
  })
})
