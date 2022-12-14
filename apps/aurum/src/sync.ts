// Merging this device's records with the account's copy in Supabase. Each
// record carries the time it last changed; the newer side wins, and the merge
// lists what the server is missing or has older.
import { fromEuros, MAX_CENTS, toEuros } from './money'
import { cleanCategory, isDay, LIMITS, type Transaction } from './transactions'

/** What this device has to remember between syncs. */
export interface Stamps {
  /** The account these transactions belong to, or null while no one has signed in. */
  owner: string | null
  /** Transactions deleted here, and when, until the server has the deletion. */
  deleted: Record<string, string>
}

export const NO_STAMPS: Stamps = { owner: null, deleted: {} }

export interface TransactionRow extends SyncedRow {
  id: string
  description: string
  /** Euros, as numeric(12, 2). */
  amount: number
  type: 'income' | 'expense'
  category: string
  occurred_on: string
  created_at: string
}

/** What a row carries to sync: the time it last changed, and whether it was deleted. */
export interface SyncedRow {
  updated_at: string
  deleted_at: string | null
}

/** The changes a merge sends: rows to upsert, and deletions by key. */
export interface Changes<R> {
  rows: R[]
  deletions: { id: string; at: string }[]
}

export type Push = Changes<TransactionRow>

/** How a table's records map to its rows. `key` names a record on both sides. */
export interface Codec<T, R extends SyncedRow> {
  key: (item: T) => string
  rowKey: (row: R) => string
  updatedAt: (item: T) => string
  /** What the table accepts; anything else stays on this device. */
  syncable: (item: T) => boolean
  toRow: (item: T) => R
  fromRow: (row: R) => T
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What the table accepts (supabase/migration.sql); anything else stays on this device. */
export const syncable = (t: Transaction) =>
  UUID.test(t.id) &&
  t.description.length >= 1 &&
  t.description.length <= LIMITS.description &&
  t.category.length >= 1 &&
  t.category.length <= LIMITS.category &&
  Number.isInteger(t.amount) &&
  t.amount > 0 &&
  t.amount <= MAX_CENTS &&
  isDay(t.date)

const time = (stamp: string) => Date.parse(stamp)
const isStamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(time(value))
const isString = (value: unknown): value is string => typeof value === 'string'

/** Keeps the rows the app can trust, in cents, with the category tidied as saved data is. */
export function readRemote(rows: unknown[]): TransactionRow[] {
  const kept: TransactionRow[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const value = row as Record<string, unknown>
    const cents = fromEuros(value.amount)
    if (
      !isString(value.id) ||
      !UUID.test(value.id) ||
      !isString(value.description) ||
      value.description === '' ||
      cents === null ||
      (value.type !== 'income' && value.type !== 'expense') ||
      !isString(value.category) ||
      !isString(value.occurred_on) ||
      !isDay(value.occurred_on) ||
      !isStamp(value.created_at) ||
      !isStamp(value.updated_at) ||
      !(value.deleted_at === null || isStamp(value.deleted_at))
    )
      continue
    kept.push({
      id: value.id,
      description: value.description,
      amount: toEuros(cents),
      type: value.type,
      category: cleanCategory(value.category),
      occurred_on: value.occurred_on,
      created_at: value.created_at,
      updated_at: value.updated_at,
      deleted_at: value.deleted_at,
    })
  }
  return kept
}

/** Stamps the records a change removed; one put back (undo) drops its stamp. */
export function stampRemoved<T>(
  key: (item: T) => string,
  before: T[],
  after: T[],
  deleted: Record<string, string>,
  at: string,
): Record<string, string> {
  const kept = new Set(after.map(key))
  const next = { ...deleted }
  for (const item of before) if (!kept.has(key(item))) next[key(item)] = at
  for (const id of kept) delete next[id]
  return next
}

/** Stamps the transactions a change removed; one put back (undo) drops its stamp. */
export function stampDeletions(before: Transaction[], after: Transaction[], stamps: Stamps, at: string): Stamps {
  return { ...stamps, deleted: stampRemoved((t) => t.id, before, after, stamps.deleted, at) }
}

export const toRow = (t: Transaction): TransactionRow => ({
  id: t.id,
  description: t.description,
  amount: toEuros(t.amount),
  type: t.type,
  category: t.category,
  occurred_on: t.date,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
  deleted_at: null,
})

const fromRow = (row: TransactionRow): Transaction => ({
  id: row.id,
  description: row.description,
  amount: fromEuros(row.amount)!,
  type: row.type,
  category: row.category,
  date: row.occurred_on,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
})

export const TRANSACTION_CODEC: Codec<Transaction, TransactionRow> = {
  key: (t) => t.id,
  rowKey: (row) => row.id,
  updatedAt: (t) => t.updatedAt,
  syncable,
  toRow,
  fromRow,
}

/**
 * Merges a table's rows into this device's records. `deleted` holds the records
 * deleted here and when, until the server has the deletion.
 */
export function mergeRecords<T, R extends SyncedRow>(
  codec: Codec<T, R>,
  local: T[],
  deleted: Record<string, string>,
  remote: R[],
) {
  const pending = { ...deleted }
  const push: Changes<R> = { rows: [], deletions: [] }
  const rows = new Map(remote.map((row) => [codec.rowKey(row), row]))
  const items: T[] = []

  for (const item of local) {
    const key = codec.key(item)
    const row = rows.get(key)
    rows.delete(key)
    const changed = time(codec.updatedAt(item))
    if (!codec.syncable(item)) items.push(item)
    else if (!row || changed > time(row.updated_at)) {
      // Also brings back a record deleted elsewhere before this edit.
      push.rows.push(codec.toRow(item))
      items.push(item)
    } else if (!row.deleted_at) items.push(changed === time(row.updated_at) ? item : codec.fromRow(row))
    // Otherwise it was deleted elsewhere after this device last changed it.
  }

  // Deleted here: tell the server unless it has a newer version, which comes back.
  for (const [id, at] of Object.entries(deleted)) {
    const row = rows.get(id)
    rows.delete(id)
    if (row && !row.deleted_at && time(at) > time(row.updated_at)) {
      // The stamp stays until a later sync sees the deletion on the server.
      push.deletions.push({ id, at })
      continue
    }
    delete pending[id]
    if (row && !row.deleted_at) items.push(codec.fromRow(row))
  }

  for (const row of rows.values()) if (!row.deleted_at) items.push(codec.fromRow(row))

  return { items, deleted: pending, push }
}

/** Merges the account's rows into this device's transactions. */
export function merge(local: Transaction[], stamps: Stamps, remote: TransactionRow[]) {
  const result = mergeRecords(TRANSACTION_CODEC, local, stamps.deleted, remote)
  return { transactions: result.items, stamps: { ...stamps, deleted: result.deleted }, push: result.push }
}
