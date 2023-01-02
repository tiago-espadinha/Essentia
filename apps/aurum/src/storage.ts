import { validBudget, type Budget } from './budgets'
import { MAX_CENTS } from './money'
import { validRecurring, type RecurringItem } from './recurring'
import { cleanCategory, isDay, type Transaction } from './transactions'
import { NO_STAMPS, type Stamps } from './sync'

export const TRANSACTIONS_KEY = 'essentia-aurum-transactions'
export const SYNC_KEY = 'essentia-aurum-sync'
export const BUDGETS_KEY = 'essentia-aurum-budgets'

/** The budgets, and those removed here and when, until the server has the removal. */
export interface SavedBudgets {
  budgets: Budget[]
  deleted: Record<string, string>
}

export const NO_BUDGETS: SavedBudgets = { budgets: [], deleted: {} }

export const RECURRING_KEY = 'essentia-aurum-recurring'

/** The recurring items, and those deleted here and when, until the server has the deletion. */
export interface SavedRecurring {
  items: RecurringItem[]
  deleted: Record<string, string>
}

export const NO_RECURRING: SavedRecurring = { items: [], deleted: {} }

const isString = (value: unknown): value is string => typeof value === 'string'
const isStringOrNull = (value: unknown) => value === null || isString(value)
const isTimestamp = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.description) &&
    typeof value.amount === 'number' &&
    Number.isInteger(value.amount) &&
    value.amount > 0 &&
    value.amount <= MAX_CENTS &&
    (value.type === 'income' || value.type === 'expense') &&
    isString(value.category) &&
    isString(value.date) &&
    isDay(value.date) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

const isStampMap = (value: unknown): value is Record<string, string> =>
  isRecord(value) && !Array.isArray(value) && Object.values(value).every(isTimestamp)

function isStamps(value: unknown): value is Stamps {
  return isRecord(value) && (value.owner === null || isString(value.owner)) && isStampMap(value.deleted)
}

/** Reads the saved transactions. Anything unreadable, malformed or repeated is skipped: saved data is not trusted. */
export function loadTransactions(): Transaction[] {
  let saved: unknown
  try {
    saved = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(saved)) return []
  const byId = new Map<string, Transaction>()
  for (const t of saved) {
    if (!isTransaction(t) || byId.has(t.id)) continue
    const { id, description, amount, type, category, date, createdAt, updatedAt } = t
    byId.set(id, { id, description, amount, type, category: cleanCategory(category), date, createdAt, updatedAt })
  }
  return [...byId.values()]
}

/**
 * Reads which account the transactions belong to and the deletions not yet
 * synced. Unreadable stamps start over, and with no owner the app clears the
 * transactions rather than hand them to whoever signs in.
 */
export function loadStamps(): Stamps {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null')
    return isStamps(saved) ? { owner: saved.owner, deleted: { ...saved.deleted } } : NO_STAMPS
  } catch {
    return NO_STAMPS
  }
}

/** Reads the saved budgets, one per category; anything malformed is skipped, unreadable data starts over. */
export function loadBudgets(): SavedBudgets {
  let saved: unknown
  try {
    saved = JSON.parse(localStorage.getItem(BUDGETS_KEY) ?? 'null')
  } catch {
    return NO_BUDGETS
  }
  if (!isRecord(saved) || !Array.isArray(saved.budgets) || !isStampMap(saved.deleted)) return NO_BUDGETS
  const byCategory = new Map<string, Budget>()
  for (const b of saved.budgets as unknown[]) {
    if (!isRecord(b) || !isString(b.category) || typeof b.amount !== 'number' || !isTimestamp(b.updatedAt)) continue
    const budget = { category: cleanCategory(b.category), amount: b.amount, updatedAt: b.updatedAt }
    if (validBudget(budget) && !byCategory.has(budget.category)) byCategory.set(budget.category, budget)
  }
  return { budgets: [...byCategory.values()], deleted: { ...saved.deleted } }
}

/** Reads the saved recurring items; anything malformed or repeated is skipped, unreadable data starts over. */
export function loadRecurring(): SavedRecurring {
  let saved: unknown
  try {
    saved = JSON.parse(localStorage.getItem(RECURRING_KEY) ?? 'null')
  } catch {
    return NO_RECURRING
  }
  if (!isRecord(saved) || !Array.isArray(saved.items) || !isStampMap(saved.deleted)) return NO_RECURRING
  const byId = new Map<string, RecurringItem>()
  for (const value of saved.items as unknown[]) {
    if (
      !isRecord(value) ||
      !isString(value.id) ||
      byId.has(value.id) ||
      !isTimestamp(value.createdAt) ||
      !isTimestamp(value.updatedAt)
    )
      continue
    const { id, description, amount, type, category, frequency, startOn, paused, pausedOn, resumedOn, createdAt, updatedAt } =
      value
    if (
      !isString(description) ||
      typeof amount !== 'number' ||
      !isString(type) ||
      !isString(category) ||
      !isString(frequency) ||
      !isString(startOn) ||
      typeof paused !== 'boolean' ||
      !isStringOrNull(pausedOn) ||
      !isStringOrNull(resumedOn)
    )
      continue
    const item = {
      id,
      description,
      amount,
      type,
      category: cleanCategory(category),
      frequency,
      startOn,
      paused,
      pausedOn,
      resumedOn,
      createdAt,
      updatedAt,
    }
    if (validRecurring(item as RecurringItem)) byId.set(id, item as RecurringItem)
  }
  return { items: [...byId.values()], deleted: { ...saved.deleted } }
}

/** Returns false when the browser refuses to store the data (private mode, quota). */
export function save(
  key: typeof TRANSACTIONS_KEY | typeof SYNC_KEY | typeof BUDGETS_KEY | typeof RECURRING_KEY,
  value: Transaction[] | Stamps | SavedBudgets | SavedRecurring,
): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
