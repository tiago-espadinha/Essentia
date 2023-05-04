// A habit's full history: every logged day it keeps, newest first. Only what
// the log holds is listed; a cleared day was never kept, so it never shows.

import { isNumeric, type Habit } from './habits'

/** 'done' for a yes/no check-in; an amount with a target is 'met' or 'below' it, and one without has no state. */
export type EntryState = 'done' | 'met' | 'below'

export const ENTRY_STATE_LABELS: Record<EntryState, string> = {
  done: 'Checked in',
  met: 'target met',
  below: 'below target',
}

export interface HistoryEntry {
  day: string
  value: number
  state: EntryState | null
}

export interface HistoryMonth {
  /** 'YYYY-MM', taken from the day keys. */
  month: string
  /** Logged days in the whole month, not only the ones revealed so far. */
  total: number
  entries: HistoryEntry[]
}

/** Entries revealed at first and with each "Show older". */
export const HISTORY_BATCH = 60

function stateOf(habit: Habit, value: number): EntryState | null {
  if (!isNumeric(habit)) return 'done'
  if (habit.target === null) return null
  return value >= habit.target ? 'met' : 'below'
}

/** Every kept log entry, newest day first. Day keys sort as strings, so no date conversion is needed. */
export function historyOf(habit: Habit): HistoryEntry[] {
  return Object.entries(habit.log)
    .filter(([, value]) => value > 0 && Number.isFinite(value))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, value]) => ({ day, value, state: stateOf(habit, value) }))
}

/** The first `shown` entries, grouped by month in order; each month counts all of its entries. */
export function groupByMonth(entries: HistoryEntry[], shown: number): HistoryMonth[] {
  const totals = new Map<string, number>()
  for (const { day } of entries) {
    const month = day.slice(0, 7)
    totals.set(month, (totals.get(month) ?? 0) + 1)
  }
  const months: HistoryMonth[] = []
  for (const entry of entries.slice(0, shown)) {
    const month = entry.day.slice(0, 7)
    const last = months.at(-1)
    if (last?.month === month) last.entries.push(entry)
    else months.push({ month, total: totals.get(month)!, entries: [entry] })
  }
  return months
}
