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

const KNOWN = new Set([...CATEGORIES.expense, ...CATEGORIES.income])
// An amount with a euro sign on either side, or a bare number standing alone.
const AMOUNT = /€\s*([\d.,]+)|([\d.,]+)\s*€|(?:^|\s)([\d.,]*\d[\d.,]*)(?=\s|$)/g

/**
 * Reads a line into a transaction. A leading '+' makes it income; the amount is
 * the last one written; a known category as the last word files it. Null when
 * there is no amount to read.
 */
export function parseQuickAdd(input: string): QuickAdd | null {
  let text = input.trim()
  let type: TransactionType = 'expense'
  if (text.startsWith('+')) {
    type = 'income'
    text = text.slice(1).trim()
  }

  const found = [...text.matchAll(AMOUNT)].at(-1)
  if (!found) return null
  const amount = parseAmount(found[1] ?? found[2] ?? found[3])
  if (amount === null) return null

  const words = cleanDescription(text.slice(0, found.index) + ' ' + text.slice(found.index + found[0].length)).split(' ')
  let category = DEFAULT_CATEGORY
  const last = words.at(-1)?.toLowerCase()
  if (words.length > 1 && last && KNOWN.has(last)) {
    category = cleanCategory(last)
    words.pop()
  }
  const description = words.join(' ').replace(/\s*[—–-]$/, '').trim() || (type === 'income' ? 'Income' : 'Expense')
  return { description: description.slice(0, LIMITS.description), amount, type, category }
}
