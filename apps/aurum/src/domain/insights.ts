// What the transactions add up to: week by week or month by month, and where the money went.
import { monthOf, totals, type Totals, type Transaction } from './transactions'

/** The ranges Insights compares, newest bucket last. */
export const INTERVALS = {
  weeks: { unit: 'week', count: 12 },
  months: { unit: 'month', count: 6 },
  year: { unit: 'month', count: 12 },
} as const

export type Interval = keyof typeof INTERVALS

export interface PeriodTotals extends Totals {
  /** A week's Monday as YYYY-MM-DD, or a month as YYYY-MM. */
  period: string
}

/** 'YYYY-MM' moved by whole months: ('2022-01', -1) -> '2021-12'. */
export function addMonths(month: string, count: number): string {
  const [year, number] = month.split('-').map(Number)
  const index = year * 12 + (number - 1) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' moved by whole days, counted in UTC so no clock change shifts it. */
export function addDays(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10)
}

/** The Monday of a day's week: '2023-04-30' (a Sunday) -> '2023-04-24'. */
export function weekOf(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const sinceMonday = (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7
  return addDays(day, -sinceMonday)
}

/**
 * Income, expenses and balance for each week or month of an interval, oldest
 * first, ending with the one that holds `today`. A transaction counts in the
 * bucket of its stored calendar day; a bucket with nothing in it counts as zero.
 */
export function periodTotals(transactions: Transaction[], interval: Interval, today: string): PeriodTotals[] {
  const { unit, count } = INTERVALS[interval]
  const bucketOf = unit === 'week' ? weekOf : monthOf
  const last = bucketOf(today)
  const periods = Array.from({ length: count }, (_, index) =>
    unit === 'week' ? addDays(last, 7 * (index - count + 1)) : addMonths(last, index - count + 1),
  )
  const inPeriod = new Map<string, Transaction[]>(periods.map((period) => [period, []]))
  for (const t of transactions) inPeriod.get(bucketOf(t.date))?.push(t)
  return periods.map((period) => ({ period, ...totals(inPeriod.get(period)!) }))
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
