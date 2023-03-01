// The edit form's text fields and the rules that turn them into a transaction.
import { amountText, parseAmount } from './money'
import { cleanCategory, cleanDescription, isDay, LIMITS, type Transaction, type TransactionFields, type TransactionType } from './transactions'

export interface TransactionForm {
  description: string
  amount: string
  type: TransactionType
  category: string
  date: string
}

export type FormErrors = Partial<Record<'description' | 'amount' | 'category' | 'date', string>>

export function formOf(t: Transaction): TransactionForm {
  return { description: t.description, amount: amountText(t.amount), type: t.type, category: t.category, date: t.date }
}

export function readForm(form: TransactionForm): { fields: TransactionFields; errors?: undefined } | { errors: FormErrors } {
  const errors: FormErrors = {}
  const description = cleanDescription(form.description)
  if (!description) errors.description = 'Describe the transaction.'
  else if (description.length > LIMITS.description) errors.description = `Keep it to ${LIMITS.description} characters.`

  const amount = parseAmount(form.amount)
  if (!form.amount.trim()) errors.amount = 'Enter an amount.'
  else if (amount === null) errors.amount = 'Enter an amount above zero, like 3.50.'

  const category = cleanCategory(form.category)
  if (category.length > LIMITS.category) errors.category = `Keep it to ${LIMITS.category} characters.`

  if (!isDay(form.date)) errors.date = 'Choose a date.'

  if (Object.keys(errors).length > 0) return { errors }
  return { fields: { description, amount: amount!, type: form.type, category, date: form.date } }
}
