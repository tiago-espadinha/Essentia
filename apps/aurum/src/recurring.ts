// Items that post themselves: rent every month, a salary, a yearly fee. The
// server posts them (process_due_recurring in supabase/migration.sql); the app
// keeps the list and shows when each comes next, stepping dates the same way.
import { fromEuros, MAX_CENTS, toEuros } from './money'
import { isStamp, type Codec, type SyncedRow } from './sync'
import { cleanCategory, isDay, LIMITS, newId, type TransactionFields, type TransactionType } from './transactions'

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'yearly']

export interface RecurringItem {
  id: string
  description: string
  /** Whole cents. */
  amount: number
  type: TransactionType
  category: string
  frequency: Frequency
  /** The first occurrence, YYYY-MM-DD; every later one is counted from it. */
  startOn: string
  paused: boolean
  /**
   * The last pause ran from `pausedOn` to `resumedOn` (still running while paused):
   * occurrences in it are skipped, not posted late. Ones due before it still post.
   */
  pausedOn: string | null
  resumedOn: string | null
  createdAt: string
  updatedAt: string
}

export type RecurringFields = Omit<TransactionFields, 'date'> & Pick<RecurringItem, 'frequency' | 'startOn'>

export interface RecurringRow extends SyncedRow {
  id: string
  description: string
  /** Euros, as numeric(12, 2). */
  amount: number
  type: TransactionType
  category: string
  frequency: Frequency
  start_on: string
  paused: boolean
  paused_on: string | null
  resumed_on: string | null
  created_at: string
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The `count`th occurrence after `start` (0 is `start` itself). Months and years
 * are counted from the start, so a day past the end of a shorter month lands on
 * its last day and the next month returns to the start's day: Jan 31, Feb 28,
 * Mar 31. Postgres's `date + interval` steps the same way.
 */
export function occurrence(start: string, frequency: Frequency, count: number): string {
  const [year, month, day] = start.split('-').map(Number)
  if (frequency === 'weekly') {
    const date = new Date(Date.UTC(year, month - 1, day + 7 * count))
    return date.toISOString().slice(0, 10)
  }
  const index = year * 12 + (month - 1) + (frequency === 'monthly' ? count : 12 * count)
  const [y, m] = [Math.floor(index / 12), index % 12]
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return `${y}-${pad(m + 1)}-${pad(Math.min(day, last))}`
}

/** The first occurrence after `today`: by then the server has posted every earlier one. */
export function nextAfter(item: Pick<RecurringItem, 'startOn' | 'frequency'>, today: string): string {
  let count = 0
  // A first guess close below the answer keeps a weekly item from years ago cheap.
  if (today > item.startOn) {
    const [y1, m1] = item.startOn.split('-').map(Number)
    const [y2, m2] = today.split('-').map(Number)
    const months = (y2 - y1) * 12 + (m2 - m1)
    const days = (Date.parse(today) - Date.parse(item.startOn)) / 86_400_000
    count = Math.max(
      0,
      { weekly: Math.floor(days / 7), monthly: months - 1, yearly: Math.floor(months / 12) - 1 }[item.frequency],
    )
  }
  while (occurrence(item.startOn, item.frequency, count) <= today) count += 1
  return occurrence(item.startOn, item.frequency, count)
}

export function createRecurring(fields: RecurringFields, now: Date = new Date(), id: string = newId()): RecurringItem {
  const stamp = now.toISOString()
  return { id, ...fields, paused: false, pausedOn: null, resumedOn: null, createdAt: stamp, updatedAt: stamp }
}

/** Pausing stops posting from `today`; resuming starts again from `today`, skipping what fell due between. */
export function setPaused(item: RecurringItem, paused: boolean, today: string, now: Date = new Date()): RecurringItem {
  const days = paused ? { pausedOn: today, resumedOn: null } : { resumedOn: today }
  return { ...item, paused, ...days, updatedAt: now.toISOString() }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isString = (value: unknown): value is string => typeof value === 'string'
const isDayOrNull = (value: unknown): value is string | null => value === null || (isString(value) && isDay(value))
const isFrequency = (value: unknown): value is Frequency => FREQUENCIES.includes(value as Frequency)

/** What the table accepts (supabase/migration.sql). */
export const validRecurring = (item: RecurringItem) =>
  UUID.test(item.id) &&
  item.description.length >= 1 &&
  item.description.length <= LIMITS.description &&
  item.category.length >= 1 &&
  item.category.length <= LIMITS.category &&
  Number.isInteger(item.amount) &&
  item.amount > 0 &&
  item.amount <= MAX_CENTS &&
  (item.type === 'income' || item.type === 'expense') &&
  isFrequency(item.frequency) &&
  isDay(item.startOn) &&
  (!item.paused || item.pausedOn !== null) &&
  (item.pausedOn === null || isDay(item.pausedOn)) &&
  (item.resumedOn === null || isDay(item.resumedOn))

/** Keeps the rows the app can trust, with the category tidied as saved data is. */
export function readRecurring(rows: unknown[]): RecurringRow[] {
  const kept: RecurringRow[] = []
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
      !isFrequency(value.frequency) ||
      !isString(value.start_on) ||
      !isDay(value.start_on) ||
      typeof value.paused !== 'boolean' ||
      !isDayOrNull(value.paused_on) ||
      !isDayOrNull(value.resumed_on) ||
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
      frequency: value.frequency,
      start_on: value.start_on,
      paused: value.paused,
      paused_on: value.paused_on,
      resumed_on: value.resumed_on,
      created_at: value.created_at,
      updated_at: value.updated_at,
      deleted_at: value.deleted_at,
    })
  }
  return kept
}

export const RECURRING_CODEC: Codec<RecurringItem, RecurringRow> = {
  key: (item) => item.id,
  rowKey: (row) => row.id,
  updatedAt: (item) => item.updatedAt,
  syncable: validRecurring,
  toRow: (item) => ({
    id: item.id,
    description: item.description,
    amount: toEuros(item.amount),
    type: item.type,
    category: item.category,
    frequency: item.frequency,
    start_on: item.startOn,
    paused: item.paused,
    paused_on: item.pausedOn,
    resumed_on: item.resumedOn,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: null,
  }),
  fromRow: (row) => ({
    id: row.id,
    description: row.description,
    amount: fromEuros(row.amount)!,
    type: row.type,
    category: row.category,
    frequency: row.frequency,
    startOn: row.start_on,
    paused: row.paused,
    pausedOn: row.paused_on,
    resumedOn: row.resumed_on,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }),
}
