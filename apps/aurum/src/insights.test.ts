import { describe, expect, it } from 'vitest'
import { addMonths, monthlyTotals, spendingByCategory } from './insights'
import { createTransaction, type Transaction, type TransactionFields } from './transactions'

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

describe('monthlyTotals', () => {
  const list = [
    tx({ amount: 210000, type: 'income', category: 'salary', date: '2022-11-01' }),
    tx({ amount: 350, date: '2022-11-30' }),
    tx({ amount: 1250, date: '2022-10-31' }),
    tx({ amount: 999, date: '2022-12-01' }),
    tx({ amount: 500, date: '2021-11-15' }),
  ]

  it('sums each month to the cent, oldest first, with empty months as zero', () => {
    const months = monthlyTotals(list, '2022-11', 3)
    expect(months).toEqual([
      { month: '2022-09', income: 0, expenses: 0, balance: 0 },
      { month: '2022-10', income: 0, expenses: 1250, balance: -1250 },
      { month: '2022-11', income: 210000, expenses: 350, balance: 209650 },
    ])
  })

  it('gives six months by default and leaves out later ones', () => {
    const months = monthlyTotals(list, '2022-11')
    expect(months.map((m) => m.month)).toEqual(['2022-06', '2022-07', '2022-08', '2022-09', '2022-10', '2022-11'])
    expect(months.some((m) => m.expenses === 999)).toBe(false)
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
