import { describe, expect, it } from 'vitest'
import { newBudget } from '../domain/budgets'
import { categoryUses, moveCategory, readCategoryName, suggestionsFor } from '../domain/categories'
import { createRecurring } from '../domain/recurring'
import { CATEGORIES, createTransaction, type TransactionFields } from '../domain/transactions'

const T0 = new Date('2022-12-12T09:00:00.000Z')
const T1 = new Date('2022-12-12T10:00:00.000Z')

const tx = (category: string, changes: Partial<TransactionFields> = {}) =>
  createTransaction({ description: 'x', amount: 1000, type: 'expense', category, date: '2022-12-05', ...changes }, T0)
const item = (category: string) =>
  createRecurring({ description: 'Rent', amount: 90000, type: 'expense', category, frequency: 'monthly', startOn: '2022-12-01' }, T0)

describe('category uses', () => {
  it('lists every name in use, by name, with what uses it', () => {
    const budget = newBudget('food', 20000, T0)
    expect(
      categoryUses({ transactions: [tx('food'), tx('food'), tx('salary', { type: 'income' })], recurring: [item('housing')], budgets: [budget] }),
    ).toEqual([
      { name: 'food', transactions: 2, recurring: 0, budget },
      { name: 'housing', transactions: 0, recurring: 1, budget: null },
      { name: 'salary', transactions: 1, recurring: 0, budget: null },
    ])
  })

  it('is empty with nothing recorded', () => {
    expect(categoryUses({ transactions: [], recurring: [], budgets: [] })).toEqual([])
  })
})

describe('suggestions', () => {
  it('offers the built-in categories of the type, then the account’s own, once each', () => {
    expect(suggestionsFor('income', ['eating out', 'salary'])).toEqual(['salary', 'freelance', 'investments', 'gifts', 'other', 'eating out'])
  })

  it('leaves out the other type’s built-in categories, even in use', () => {
    expect(suggestionsFor('expense', ['salary', 'pets', 'other'])).toEqual([...CATEGORIES.expense, 'pets'])
  })
})

describe('a new category name', () => {
  it('is tidied as saved categories are', () => {
    expect(readCategoryName('  Eating   Out ', 'food')).toEqual({ name: 'eating out' })
  })

  it('refuses a blank, unchanged or too long name', () => {
    expect(readCategoryName('   ', 'food')).toEqual({ error: 'Name the category.' })
    expect(readCategoryName(' FOOD', 'food')).toEqual({ error: 'That is already its name.' })
    expect(readCategoryName('x'.repeat(41), 'food')).toEqual({ error: 'Keep it to 40 characters.' })
  })
})

describe('moving a category', () => {
  it('refiles every use and stamps what changed, deleting nothing', () => {
    const lunch = tx('food')
    const salary = tx('salary', { type: 'income' })
    const moved = moveCategory({ transactions: [lunch, salary], recurring: [item('food')], budgets: [] }, 'food', 'eating out', T1)
    expect(moved.transactions).toEqual([{ ...lunch, category: 'eating out', updatedAt: T1.toISOString() }, salary])
    expect(moved.recurring).toMatchObject([{ category: 'eating out', updatedAt: T1.toISOString() }])
  })

  it('moves the budget across when the new name has none', () => {
    const transport = newBudget('transport', 5000, T0)
    const moved = moveCategory({ transactions: [], recurring: [], budgets: [newBudget('food', 20000, T0), transport] }, 'food', 'groceries', T1)
    expect(moved.budgets).toEqual([{ category: 'groceries', amount: 20000, updatedAt: T1.toISOString() }, transport])
  })

  it('keeps the existing budget on a merge and drops the moved one', () => {
    const kept = newBudget('food', 30000, T0)
    const moved = moveCategory({ transactions: [], recurring: [], budgets: [newBudget('groceries', 10000, T0), kept] }, 'groceries', 'food', T1)
    expect(moved.budgets).toEqual([kept])
  })
})
