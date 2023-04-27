import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from '../domain/quickAdd'

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

  it('makes a plus on the amount income, keeping it out of the description', () => {
    const coffee = { description: 'coffee', amount: 350, type: 'income', category: 'other' }
    expect(parseQuickAdd('coffee +3.50')).toEqual(coffee)
    expect(parseQuickAdd('+ coffee 3.50')).toEqual(coffee)
    expect(parseQuickAdd('coffee +€3.50')).toEqual(coffee)
    expect(parseQuickAdd('coffee +3,50€')).toEqual(coffee)
    expect(parseQuickAdd('+coffee +3.50')).toEqual(coffee)
    expect(parseQuickAdd('Invoice +€450 freelance')).toEqual({ description: 'Invoice', amount: 45_000, type: 'income', category: 'freelance' })
  })

  it('leaves a plus elsewhere in the line as part of the description', () => {
    expect(parseQuickAdd('C++ book 30')).toEqual({ description: 'C++ book', amount: 3000, type: 'expense', category: 'other' })
    expect(parseQuickAdd('Salt + pepper €3')).toMatchObject({ description: 'Salt + pepper', type: 'expense' })
    expect(parseQuickAdd('coffee + 3.50')).toMatchObject({ description: 'coffee +', type: 'expense' })
    expect(parseQuickAdd('Top up +5 €20')).toMatchObject({ description: 'Top up +5', amount: 2000, type: 'expense' })
    expect(parseQuickAdd('Top up+€5')).toMatchObject({ description: 'Top up+', amount: 500, type: 'expense' })
    expect(parseQuickAdd('x+3€')).toMatchObject({ description: 'x+', amount: 300, type: 'expense' })
  })

  it('keeps a spaced dash before the amount as a separator for income', () => {
    const salary = { description: 'Salary', amount: 210_000, type: 'income', category: 'other' }
    expect(parseQuickAdd('+Salary - 2100')).toEqual(salary)
    expect(parseQuickAdd('+Salary - €2100')).toEqual(salary)
    expect(parseQuickAdd('Salary - +2100')).toEqual(salary)
  })

  it('keeps the money rules for an amount with a plus', () => {
    expect(parseQuickAdd('coffee +1.234,56')?.amount).toBe(123_456)
    expect(parseQuickAdd('coffee +3.5')?.amount).toBe(350)
    for (const amount of ['3.505', '12,5', '1,234.56', '€7']) {
      expect(parseQuickAdd(`coffee +${amount}`)?.amount).toBe(parseQuickAdd(`coffee ${amount}`)?.amount)
    }
  })

  it('files a known category given as the last word', () => {
    expect(parseQuickAdd('Rent €900 housing')).toEqual({ description: 'Rent', amount: 90_000, type: 'expense', category: 'housing' })
    expect(parseQuickAdd('+Invoice 42 €450 Freelance')).toMatchObject({ description: 'Invoice 42', category: 'freelance', type: 'income' })
  })

  it('files one of the account’s own categories, several words long too', () => {
    const own = ['eating out', 'pets']
    expect(parseQuickAdd('Dinner €30 Eating Out', own)).toEqual({ description: 'Dinner', amount: 3000, type: 'expense', category: 'eating out' })
    expect(parseQuickAdd('Vet 45 pets', own)).toMatchObject({ description: 'Vet', category: 'pets' })
    expect(parseQuickAdd('Vet 45 pets')).toMatchObject({ description: 'Vet pets', category: 'other' })
  })

  it('leaves a word to describe the line', () => {
    expect(parseQuickAdd('Eating out €30', ['eating out'])).toMatchObject({ description: 'Eating out', category: 'other' })
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

  it.each(['', '   ', 'Coffee', 'Coffee €0', 'Coffee €3.5.5', '+', 'coffee +', 'coffee +0', 'coffee +€3.5.5', 'coffee ++3.50', 'coffee -3.50', '+coffee -€3.50', '+coffee −3,50€', '+coffee -3.50€', 'coffee -+3.50'])('reads nothing from %j', (input) => {
    expect(parseQuickAdd(input)).toBeNull()
  })

  it('caps the description at the table limit', () => {
    expect(parseQuickAdd(`${'x'.repeat(300)} €1`)?.description).toHaveLength(200)
  })
})
