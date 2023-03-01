// What the transactions add up to: month by month, and where the money went.
import { monthOf, totals, type Totals, type Transaction } from './transactions'

export interface MonthTotals extends Totals {
  /** YYYY-MM */
  month: string
}

/** 'YYYY-MM' moved by whole months: ('2022-01', -1) -> '2021-12'. */
export function addMonths(month: string, count: number): string {
  const [year, number] = month.split('-').map(Number)
  const index = year * 12 + (number - 1) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/**
 * Income, expenses and balance for each of the `count` calendar months up to
 * and including `last`, oldest first; a month with nothing in it counts as zero.
 */
export function monthlyTotals(transactions: Transaction[], last: string, count = 6): MonthTotals[] {
  const months = Array.from({ length: count }, (_, index) => addMonths(last, index - count + 1))
  return months.map((month) => ({ month, ...totals(transactions.filter((t) => monthOf(t.date) === month)) }))
}

export interface CategorySpend {
  category: string
  /** Cents. */
  amount: number
  /** Of the month's expenses, 0 to 1. */
  share: number
}

/** A month's expenses by category, largest first. */
export function spendingByCategory(transactions: Transaction[], month: string): CategorySpend[] {
  const sums = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || monthOf(t.date) !== month) continue
    sums.set(t.category, (sums.get(t.category) ?? 0) + t.amount)
  }
  const total = [...sums.values()].reduce((sum, amount) => sum + amount, 0)
  return [...sums]
    .map(([category, amount]) => ({ category, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
}
