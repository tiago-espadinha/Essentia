// Monthly limits per expense category, and how this month's spending stands
// against them. A budget is named by its category, here and in the table.
import { fromEuros, MAX_CENTS, toEuros } from './money'
import { isStamp, type Codec, type SyncedRow } from './sync'
import { cleanCategory, LIMITS, monthOf, type Transaction } from './transactions'

export interface Budget {
  /** Lowercase, as transactions file it. */
  category: string
  /** Whole cents a month. */
  amount: number
  updatedAt: string
}

export interface BudgetRow extends SyncedRow {
  category: string
  /** Euros, as numeric(12, 2). */
  amount: number
}

export const newBudget = (category: string, amount: number, now: Date = new Date()): Budget => ({
  category: cleanCategory(category),
  amount,
  updatedAt: now.toISOString(),
})

export interface BudgetStatus extends Budget {
  /** Cents spent in the category this month. */
  spent: number
  /** Cents still free; negative once over. */
  left: number
}

/** Each budget against the month's expenses in its category, by category name. */
export function budgetStatus(budgets: Budget[], transactions: Transaction[], month: string): BudgetStatus[] {
  const spent = new Map<string, number>()
  for (const t of transactions) {
    if (t.type === 'expense' && monthOf(t.date) === month) spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount)
  }
  return budgets
    .map((budget) => {
      const amount = spent.get(budget.category) ?? 0
      return { ...budget, spent: amount, left: budget.amount - amount }
    })
    .sort((a, b) => a.category.localeCompare(b.category))
}

export const validBudget = (budget: Budget) =>
  budget.category.length >= 1 &&
  budget.category.length <= LIMITS.category &&
  Number.isInteger(budget.amount) &&
  budget.amount > 0 &&
  budget.amount <= MAX_CENTS

/**
 * Keeps the rows the app can trust. The category names the row, so one not
 * written the way the app writes it ('Food', ' food') is skipped rather than
 * tidied: a removal sent under the tidied name would never reach it.
 */
export function readBudgets(rows: unknown[]): BudgetRow[] {
  const kept: BudgetRow[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const value = row as Record<string, unknown>
    const cents = fromEuros(value.amount)
    if (
      typeof value.category !== 'string' ||
      value.category === '' ||
      value.category !== cleanCategory(value.category) ||
      cents === null ||
      !isStamp(value.updated_at) ||
      !(value.deleted_at === null || isStamp(value.deleted_at))
    )
      continue
    kept.push({
      category: value.category,
      amount: toEuros(cents),
      updated_at: value.updated_at,
      deleted_at: value.deleted_at,
    })
  }
  return kept
}

export const BUDGET_CODEC: Codec<Budget, BudgetRow> = {
  key: (budget) => budget.category,
  rowKey: (row) => row.category,
  updatedAt: (budget) => budget.updatedAt,
  syncable: validBudget,
  toRow: (budget) => ({
    category: budget.category,
    amount: toEuros(budget.amount),
    updated_at: budget.updatedAt,
    deleted_at: null,
  }),
  fromRow: (row) => ({
    category: row.category,
    amount: fromEuros(row.amount)!,
    updatedAt: new Date(row.updated_at).toISOString(),
  }),
}
