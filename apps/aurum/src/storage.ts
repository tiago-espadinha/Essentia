import { MAX_CENTS } from './money'
import { cleanCategory, isDay, type Transaction } from './transactions'
import { NO_STAMPS, type Stamps } from './sync'

export const TRANSACTIONS_KEY = 'essentia-aurum-transactions'
export const SYNC_KEY = 'essentia-aurum-sync'

const isString = (value: unknown): value is string => typeof value === 'string'
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

function isStamps(value: unknown): value is Stamps {
  return (
    isRecord(value) &&
    (value.owner === null || isString(value.owner)) &&
    isRecord(value.deleted) &&
    !Array.isArray(value.deleted) &&
    Object.values(value.deleted).every(isTimestamp)
  )
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

/** Returns false when the browser refuses to store the data (private mode, quota). */
export function save(key: typeof TRANSACTIONS_KEY | typeof SYNC_KEY, value: Transaction[] | Stamps): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
