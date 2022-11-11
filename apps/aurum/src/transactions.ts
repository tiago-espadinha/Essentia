// The transaction model and the pure rules around it. Amounts are whole cents;
// `date` is the local calendar day the money moved; stamps are ISO timestamps.

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  description: string
  /** Whole cents, always positive; `type` says which way the money went. */
  amount: number
  type: TransactionType
  /** Lowercase; 'other' when none is given. */
  category: string
  /** YYYY-MM-DD in the user's own calendar. */
  date: string
  createdAt: string
  updatedAt: string
}

export type TransactionFields = Pick<Transaction, 'description' | 'amount' | 'type' | 'category' | 'date'>

/** The table's checks (supabase/migration.sql). */
export const LIMITS = { description: 200, category: 40 }

export const DEFAULT_CATEGORY = 'other'

/** Offered while typing a category; any other word works too. */
export const CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['housing', 'food', 'transport', 'utilities', 'health', 'entertainment', 'lifestyle', 'other'],
  income: ['salary', 'freelance', 'investments', 'gifts', 'other'],
}

/**
 * A random (version 4) uuid, the form the synced table stores. `crypto.randomUUID`
 * exists only in secure contexts (https or localhost), so plain-http LAN testing
 * builds one from `getRandomValues`.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** The local calendar day of a moment (not `toISOString`, which is UTC). */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayKey(): string {
  return dayKey(new Date())
}

/** A real calendar day as YYYY-MM-DD: '2022-02-30' is not one. */
export function isDay(value: string): boolean {
  const match = DAY.exec(value)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value
}

/** '2022-11-03' -> '2022-11', the month a transaction counts in. */
export const monthOf = (day: string) => day.slice(0, 7)

/** '2022-11' -> 'November 2022'. */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(year, number - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** '2022-11-03' -> 'Nov 3'. */
export function shortDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** '  Food ' -> 'food'; nothing -> 'other'. */
export function cleanCategory(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase() || DEFAULT_CATEGORY
}

export const cleanDescription = (text: string) => text.trim().replace(/\s+/g, ' ')

export function createTransaction(fields: TransactionFields, now: Date = new Date(), id: string = newId()): Transaction {
  const stamp = now.toISOString()
  return { id, ...fields, createdAt: stamp, updatedAt: stamp }
}

export function applyChanges(transaction: Transaction, changes: Partial<TransactionFields>, now: Date = new Date()): Transaction {
  return { ...transaction, ...changes, updatedAt: now.toISOString() }
}

/** Newest day first; within a day, the one added last first. */
export function byDate(a: Transaction, b: Transaction): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
}

export interface Totals {
  income: number
  expenses: number
  /** Income less expenses; negative when more went out. */
  balance: number
}

export function totals(transactions: Transaction[]): Totals {
  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount
    else expenses += t.amount
  }
  return { income, expenses, balance: income - expenses }
}
