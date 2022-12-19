import { describe, expect, it } from 'vitest'
import { BUDGET_CODEC, budgetStatus, readBudgets, newBudget, type BudgetRow } from './budgets'
import { mergeRecords } from './sync'
import { createTransaction, type TransactionFields } from './transactions'

const T0 = '2022-12-12T09:00:00.000Z'
const T1 = '2022-12-12T10:00:00.000Z'
const T2 = '2022-12-12T11:00:00.000Z'

const tx = (fields: Partial<TransactionFields>) =>
  createTransaction({ description: 'x', amount: 1000, type: 'expense', category: 'food', date: '2022-12-05', ...fields })

const row = (changes: Partial<BudgetRow> = {}): BudgetRow => ({
  category: 'food',
  amount: 300,
  updated_at: T1,
  deleted_at: null,
  ...changes,
})

describe('budget status', () => {
  it('sets this month’s expenses in the category against the limit, by category name', () => {
    const budgets = [newBudget('Transport', 5000), newBudget('food', 20000)]
    const transactions = [
      tx({ amount: 12000 }),
      tx({ amount: 9000, date: '2022-12-30' }),
      tx({ amount: 4000, date: '2022-11-30' }),
      tx({ amount: 50000, type: 'income' }),
      tx({ amount: 700, category: 'transport' }),
    ]
    expect(
      budgetStatus(budgets, transactions, '2022-12').map(({ category, spent, left }) => ({ category, spent, left })),
    ).toEqual([
      { category: 'food', spent: 21000, left: -1000 },
      { category: 'transport', spent: 700, left: 4300 },
    ])
  })

  it('counts nothing spent in a category with no expenses', () => {
    expect(budgetStatus([newBudget('gifts', 100)], [], '2022-12')[0]).toMatchObject({ spent: 0, left: 100 })
  })
})

describe('budget rows', () => {
  it('keeps rows it can trust, in euros', () => {
    expect(readBudgets([row({ amount: '300.50' as unknown as number })])).toEqual([row({ amount: 300.5 })])
  })

  it('skips a row whose category is not written as the app writes it, since the category names it', () => {
    expect(readBudgets([row({ category: 'Food' }), row({ category: ' food' }), row({ category: 'eating  out' })])).toEqual([])
  })

  it('skips malformed rows', () => {
    expect(
      readBudgets([null, row({ amount: 0 }), row({ category: '' }), row({ updated_at: 'soon' }), { category: 'food' }]),
    ).toEqual([])
  })

  it('round-trips through the codec in cents', () => {
    const budget = newBudget('food', 30050, new Date(T1))
    expect(BUDGET_CODEC.toRow(budget)).toEqual(row({ amount: 300.5 }))
    expect(BUDGET_CODEC.fromRow(BUDGET_CODEC.toRow(budget))).toEqual(budget)
  })
})

describe('merging budgets', () => {
  it('meets another device’s budget for the same category in one, the newer limit winning', () => {
    const local = newBudget('food', 20000, new Date(T2))
    const result = mergeRecords(BUDGET_CODEC, [local], {}, [row()])
    expect(result.items).toEqual([local])
    expect(result.push.rows).toEqual([row({ amount: 200, updated_at: T2 })])

    const older = mergeRecords(BUDGET_CODEC, [newBudget('food', 20000, new Date(T0))], {}, [row()])
    expect(older.items).toEqual([BUDGET_CODEC.fromRow(row())])
    expect(older.push.rows).toEqual([])
  })

  it('sends a removal by category, and drops a budget removed elsewhere', () => {
    const removed = mergeRecords(BUDGET_CODEC, [], { food: T2 }, [row()])
    expect(removed.push.deletions).toEqual([{ id: 'food', at: T2 }])
    expect(mergeRecords(BUDGET_CODEC, [newBudget('food', 100, new Date(T0))], {}, [row({ deleted_at: T1 })]).items).toEqual([])
  })
})
