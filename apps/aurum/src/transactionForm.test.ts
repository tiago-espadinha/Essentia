import { describe, expect, it } from 'vitest'
import { formOf, readForm, type TransactionForm } from './transactionForm'
import { createTransaction } from './transactions'

const form = (changes: Partial<TransactionForm> = {}): TransactionForm => ({
  description: 'Coffee',
  amount: '3.50',
  type: 'expense',
  category: 'food',
  date: '2022-11-08',
  ...changes,
})

describe('transaction form', () => {
  it('fills the form from a transaction', () => {
    const t = createTransaction({ description: 'Rent', amount: 90_000, type: 'expense', category: 'housing', date: '2022-11-01' })
    expect(formOf(t)).toEqual({ description: 'Rent', amount: '900.00', type: 'expense', category: 'housing', date: '2022-11-01' })
  })

  it('reads a valid form, tidying the text', () => {
    expect(readForm(form({ description: '  Flat   white ', amount: '3,5', category: ' Eating Out ' }))).toEqual({
      fields: { description: 'Flat white', amount: 350, type: 'expense', category: 'eating out', date: '2022-11-08' },
    })
    expect(readForm(form({ category: '' }))).toMatchObject({ fields: { category: 'other' } })
  })

  it('says what to fix in each field', () => {
    expect(readForm(form({ description: ' ', amount: '', category: 'c'.repeat(41), date: '' }))).toEqual({
      errors: {
        description: 'Describe the transaction.',
        amount: 'Enter an amount.',
        category: 'Keep it to 40 characters.',
        date: 'Choose a date.',
      },
    })
    expect(readForm(form({ description: 'x'.repeat(201), amount: '0', date: '2022-02-30' }))).toEqual({
      errors: {
        description: 'Keep it to 200 characters.',
        amount: 'Enter an amount above zero, like 3.50.',
        date: 'Choose a date.',
      },
    })
  })
})
