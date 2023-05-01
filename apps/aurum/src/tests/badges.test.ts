import { describe, expect, it } from 'vitest'
import { badges, type BadgeData } from '../domain/badges'
import { newBudget } from '../domain/budgets'
import { moveCategory } from '../domain/categories'
import { createRecurring, setPaused } from '../domain/recurring'
import { createTransaction, type TransactionFields } from '../domain/transactions'

const TODAY = '2023-05-01'

const tx = (fields: Partial<TransactionFields> = {}) =>
  createTransaction({ description: 'x', amount: 1000, type: 'expense', category: 'food', date: '2023-04-05', ...fields })

const many = (count: number, fields: Partial<TransactionFields> = {}) => Array.from({ length: count }, () => tx(fields))

const inMonths = (...months: string[]) => months.map((month) => tx({ date: `${month}-10` }))

const recurringItem = () =>
  createRecurring({ description: 'rent', amount: 50000, type: 'expense', category: 'housing', frequency: 'monthly', startOn: '2023-04-01' })

const data = (changes: Partial<BadgeData> = {}): BadgeData => ({ transactions: [], budgets: [], recurring: [], ...changes })

/** The ids of the earned badges. */
const earned = (input: BadgeData, today = TODAY) =>
  badges(input, today)
    .filter((badge) => badge.earned)
    .map((badge) => badge.id)

const badge = (input: BadgeData, id: string, today = TODAY) => badges(input, today).find((b) => b.id === id)!

describe('finance badges', () => {
  it('lists all eight badges, none earned, for an empty account', () => {
    const all = badges(data(), TODAY)
    expect(all.map((b) => b.id)).toEqual([
      'first-entry',
      '50-entries',
      '250-entries',
      '3-month-run',
      '12-month-run',
      'first-budget',
      'first-recurring',
      'in-the-black',
    ])
    expect(all.every((b) => !b.earned)).toBe(true)
  })

  it('counts transactions of either type and any date towards the entry badges', () => {
    const transactions = [...many(48), tx({ type: 'income' }), tx({ date: '2024-01-01' })]
    expect(earned(data({ transactions }))).toEqual(expect.arrayContaining(['first-entry', '50-entries']))
    expect(badge(data({ transactions }), '250-entries').progress).toEqual({ value: 50, goal: 250, unit: 'transactions' })
  })

  it('shows progress up to the goal and no further', () => {
    expect(badge(data({ transactions: many(49) }), '50-entries')).toMatchObject({ earned: false, progress: { value: 49, goal: 50, unit: 'transactions' } })
    expect(badge(data({ transactions: many(260) }), '250-entries')).toMatchObject({ earned: true, progress: { value: 250, goal: 250, unit: 'transactions' } })
  })

  it('takes an entry badge away once the transactions under it are deleted', () => {
    const transactions = many(50)
    expect(earned(data({ transactions }))).toContain('50-entries')
    expect(earned(data({ transactions: transactions.slice(1) }))).not.toContain('50-entries')
  })

  it('counts the longest run of consecutive months, across a year end', () => {
    const transactions = inMonths('2022-01', '2022-11', '2022-12', '2023-01', '2023-03')
    expect(badge(data({ transactions }), '3-month-run')).toMatchObject({ earned: true, progress: { value: 3, goal: 3, unit: 'months' } })
    expect(badge(data({ transactions }), '12-month-run').progress).toEqual({ value: 3, goal: 12, unit: 'months' })
  })

  it('breaks a run on a month with nothing recorded', () => {
    const transactions = inMonths('2023-01', '2023-02', '2023-04')
    expect(badge(data({ transactions }), '3-month-run')).toMatchObject({ earned: false, progress: { value: 2, goal: 3, unit: 'months' } })
  })

  it('lets the current month count but not a future one', () => {
    expect(earned(data({ transactions: inMonths('2023-03', '2023-04', '2023-05') }))).toContain('3-month-run')
    expect(earned(data({ transactions: inMonths('2023-04', '2023-05', '2023-06') }))).not.toContain('3-month-run')
  })

  it('earns a year on the books from twelve months in a row, imported history included', () => {
    const months = Array.from({ length: 12 }, (_, index) => `2022-${String(index + 1).padStart(2, '0')}`)
    expect(earned(data({ transactions: inMonths(...months) }))).toContain('12-month-run')
  })

  it('earns the plan badges from a budget and a recurring item, paused or not', () => {
    const paused = setPaused(recurringItem(), true, TODAY)
    expect(earned(data({ budgets: [newBudget('food', 20000)], recurring: [paused] }))).toEqual([
      'first-budget',
      'first-recurring',
    ])
    expect(earned(data({ budgets: [], recurring: [] }))).toEqual([])
  })

  it('earns in the black from a finished month with more income than expenses', () => {
    const transactions = [tx({ type: 'income', amount: 1001, date: '2023-03-31' }), tx({ amount: 1000, date: '2023-03-01' })]
    expect(earned(data({ transactions }))).toContain('in-the-black')
  })

  it('does not count a month that broke even or is still running', () => {
    const even = [tx({ type: 'income', amount: 1000, date: '2023-03-31' }), tx({ amount: 1000, date: '2023-03-01' })]
    expect(earned(data({ transactions: even }))).not.toContain('in-the-black')
    const thisMonth = [tx({ type: 'income', amount: 5000, date: '2023-05-01' })]
    expect(earned(data({ transactions: thisMonth }))).not.toContain('in-the-black')
  })

  it('never earns a badge by spending more', () => {
    const transactions = [tx({ type: 'income', amount: 5000, date: '2023-03-10' }), tx({ amount: 1000, date: '2023-03-11' })]
    const bigger = transactions.map((t) => (t.type === 'expense' ? { ...t, amount: 9000 } : t))
    expect(earned(data({ transactions }))).toContain('in-the-black')
    expect(earned(data({ transactions: bigger }))).not.toContain('in-the-black')
  })

  it('gives the same badges for the same records, however often they are read', () => {
    const input = data({ transactions: [...many(50), ...inMonths('2023-02', '2023-03')], budgets: [newBudget('food', 100)] })
    const again = data({ ...input, transactions: [...input.transactions].reverse() })
    expect(badges(again, TODAY)).toEqual(badges(input, TODAY))
  })

  it('keeps every badge when a category is renamed or merged', () => {
    const input = data({
      transactions: [...many(50), tx({ type: 'income', amount: 90000, date: '2023-03-01' })],
      budgets: [newBudget('food', 20000)],
      recurring: [recurringItem()],
    })
    const moved = moveCategory(input, 'food', 'groceries')
    expect(earned(moved)).toEqual(earned(input))
  })
})
