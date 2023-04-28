// The categories the account uses, and moving one into another: a rename, a
// merge into an existing name, or a removal that files its uses elsewhere.
// A category is only a name on transactions, recurring items and budgets, so
// it exists while something uses it; nothing is ever deleted by a move.
import { newBudget, type Budget } from './budgets'
import type { RecurringItem } from './recurring'
import { applyChanges, CATEGORIES, cleanCategory, LIMITS, type Transaction, type TransactionType } from './transactions'

export interface CategoryUse {
  name: string
  transactions: number
  recurring: number
  budget: Budget | null
}

export interface CategorizedData {
  transactions: Transaction[]
  recurring: RecurringItem[]
  budgets: Budget[]
}

/** Every category in use, by name, with what uses it. */
export function categoryUses({ transactions, recurring, budgets }: CategorizedData): CategoryUse[] {
  const uses = new Map<string, CategoryUse>()
  const entry = (name: string) => {
    let found = uses.get(name)
    if (!found) uses.set(name, (found = { name, transactions: 0, recurring: 0, budget: null }))
    return found
  }
  for (const t of transactions) entry(t.category).transactions++
  for (const item of recurring) entry(item.category).recurring++
  for (const budget of budgets) entry(budget.category).budget = budget
  return [...uses.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Offered while typing a category of the type: its built-in ones, then the account's own, less the other type's built-in ones. */
export function suggestionsFor(type: TransactionType, own: string[]): string[] {
  const other = CATEGORIES[type === 'income' ? 'expense' : 'income']
  return [...new Set([...CATEGORIES[type], ...own.filter((name) => !other.includes(name))])]
}

/** The name a category is to take, or why it can't. */
export function readCategoryName(input: string, from: string): { name?: string; error?: string } {
  if (!input.trim()) return { error: 'Name the category.' }
  const name = cleanCategory(input)
  if (name.length > LIMITS.category) return { error: `Keep it to ${LIMITS.category} characters.` }
  if (name === from) return { error: 'That is already its name.' }
  return { name }
}

/**
 * Files everything under `from` under `to` instead. When both have a budget,
 * `to` keeps its own and `from`'s goes; otherwise `from`'s limit moves across.
 */
export function moveCategory(data: CategorizedData, from: string, to: string, now: Date = new Date()): CategorizedData {
  const stamp = now.toISOString()
  const moving = data.budgets.find((b) => b.category === from)
  const others = data.budgets.filter((b) => b.category !== from)
  return {
    transactions: data.transactions.map((t) => (t.category === from ? applyChanges(t, { category: to }, now) : t)),
    recurring: data.recurring.map((item) => (item.category === from ? { ...item, category: to, updatedAt: stamp } : item)),
    budgets: !moving || others.some((b) => b.category === to) ? others : [newBudget(to, moving.amount, now), ...others],
  }
}
