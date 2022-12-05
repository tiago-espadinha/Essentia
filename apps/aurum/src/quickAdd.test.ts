import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAdd'

describe('parseQuickAdd', () => {
  it('reads an expense with a euro sign before or after', () => {
    expect(parseQuickAdd('Coffee €3.50')).toEqual({ description: 'Coffee', amount: 350, type: 'expense', category: 'other' })
    expect(parseQuickAdd('Coffee 3,50€')).toEqual({ description: 'Coffee', amount: 350, type: 'expense', category: 'other' })
  })

  it('reads a bare amount', () => {
    expect(parseQuickAdd('Lunch 12')?.amount).toBe(1200)
  })

  it('makes a leading plus income', () => {
    expect(parseQuickAdd('+Salary €2100')).toEqual({ description: 'Salary', amount: 210_000, type: 'income', category: 'other' })
  })

  it('files a known category given as the last word', () => {
    expect(parseQuickAdd('Rent €900 housing')).toEqual({ description: 'Rent', amount: 90_000, type: 'expense', category: 'housing' })
    expect(parseQuickAdd('+Invoice 42 €450 Freelance')).toMatchObject({ description: 'Invoice 42', category: 'freelance', type: 'income' })
  })

  it('keeps an unknown last word in the description', () => {
    expect(parseQuickAdd('Train to Porto €18')).toMatchObject({ description: 'Train to Porto', category: 'other' })
    expect(parseQuickAdd('Gift for Ana €30 birthday')).toMatchObject({ description: 'Gift for Ana birthday' })
  })

  it('takes the last amount, so numbers can stay in the description', () => {
    expect(parseQuickAdd('2 coffees €7')).toMatchObject({ description: '2 coffees', amount: 700 })
  })

  it('names a transaction with no words', () => {
    expect(parseQuickAdd('€5')).toMatchObject({ description: 'Expense', amount: 500 })
    expect(parseQuickAdd('+ 5')).toMatchObject({ description: 'Income', amount: 500 })
  })

  it('drops a trailing dash before the amount', () => {
    expect(parseQuickAdd('Books — €20')).toMatchObject({ description: 'Books' })
  })

  it.each(['', '   ', 'Coffee', 'Coffee €0', 'Coffee €3.5.5', '+'])('reads nothing from %j', (input) => {
    expect(parseQuickAdd(input)).toBeNull()
  })

  it('caps the description at the table limit', () => {
    expect(parseQuickAdd(`${'x'.repeat(300)} €1`)?.description).toHaveLength(200)
  })
})
