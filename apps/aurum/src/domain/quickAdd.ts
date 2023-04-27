// The one-line add field: 'Coffee €3.50', '+Salary 2100', 'Rent €900 housing'.
import { parseAmount } from './money'
import { CATEGORIES, cleanCategory, cleanDescription, DEFAULT_CATEGORY, LIMITS, type TransactionType } from './transactions'

export interface QuickAdd {
  description: string
  amount: number
  type: TransactionType
  category: string
}

export const QUICK_ADD_HINT = 'Write a description and an amount, like “Coffee €3.50” or “+Salary €2100”.'

const BUILT_IN = [...CATEGORIES.expense, ...CATEGORIES.income]
// An amount with a euro sign on either side, or a bare number standing alone. A '+' starting
// the amount's word ('+3.50', '+€3.50') marks income; one inside a word ('Top up+€5') does not.
const AMOUNT = /(?:(?<!\S)(\+))?€\s*([\d.,]+)|(?:(?<!\S)(\+))?([\d.,]+)\s*€|(?:^|\s)(\+?)([\d.,]*\d[\d.,]*)(?=\s|$)/g
const MINUS = new Set(['-', '−'])

/**
 * Reads a line into a transaction. A '+' at the start or on the amount ('+Salary 2100',
 * 'Coffee +3.50') makes it income; the amount is the last one written; a category the
 * line ends with, built in or one of the account's `own` ('Dinner 30 eating out'), files
 * it. Null when there is no amount to read, or when income
 * meets a minus on the amount.
 */
export function parseQuickAdd(input: string, own: string[] = []): QuickAdd | null {
  let text = input.trim()
  let type: TransactionType = 'expense'
  if (text.startsWith('+')) {
    type = 'income'
    text = text.slice(1).trim()
  }

  const found = [...text.matchAll(AMOUNT)].at(-1)
  if (!found) return null
  if (found[1] || found[3] || found[5]) type = 'income'
  // '+Refund -€5' and 'Refund -+€5' say both; refuse them rather than guess.
  const start = found.index + found[0].length - found[0].trimStart().length
  if (type === 'income' && MINUS.has(text[start - 1])) return null
  const amount = parseAmount(found[2] ?? found[4] ?? found[6])
  if (amount === null) return null

  const words = cleanDescription(text.slice(0, found.index) + ' ' + text.slice(found.index + found[0].length)).split(' ')
  let category = DEFAULT_CATEGORY
  const known = new Set([...BUILT_IN, ...own])
  // The longest name the line ends with, leaving at least one word to describe it.
  for (let count = words.length - 1; count >= 1; count--) {
    const name = cleanCategory(words.slice(-count).join(' '))
    if (known.has(name)) {
      category = name
      words.splice(-count)
      break
    }
  }
  const description = words.join(' ').replace(/\s*[—–-]$/, '').trim() || (type === 'income' ? 'Income' : 'Expense')
  return { description: description.slice(0, LIMITS.description), amount, type, category }
}
