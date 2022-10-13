// Merging this device's habits with the account's copy in Supabase. Each habit's
// settings and each day's check-in carry the time they last changed; the newer
// side wins, and the merge lists what the server is missing or has older.
import { DEFAULT_CATEGORY, isDay, type Habit, type Weekday } from './habits'

/** When this device last changed each thing. */
export interface Stamps {
  /** The account these habits belong to, or null while they have never been synced. */
  owner: string | null
  /** Settings changed, or the habit was added or restored. */
  habits: Record<string, string>
  deleted: Record<string, string>
  /** A day's check-in set, changed or cleared, per habit. */
  days: Record<string, Record<string, string>>
}

export const NO_STAMPS: Stamps = { owner: null, habits: {}, deleted: {}, days: {} }

export interface HabitRow {
  id: string
  name: string
  category: string
  days: Weekday[]
  unit: string
  target: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** A cleared check-in is kept as value 0, so other devices see it go. */
export interface CheckInRow {
  habit_id: string
  day: string
  value: number
  updated_at: string
}

export interface Remote {
  habits: HabitRow[]
  checkIns: CheckInRow[]
}

export interface Push {
  habits: HabitRow[]
  deletions: { id: string; at: string }[]
  checkIns: CheckInRow[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Ids from before sync, or tampered ones, cannot be stored as uuids; those habits stay on this device. */
const syncable = (id: string) => UUID.test(id)

const time = (stamp: string) => Date.parse(stamp)
const isStamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(time(value))
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const isAmount = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min
const isWeekday = (value: unknown): value is Weekday => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6

function isHabitRow(row: Record<string, unknown>): boolean {
  return (
    typeof row.id === 'string' &&
    syncable(row.id) &&
    isText(row.name) &&
    isText(row.category) &&
    Array.isArray(row.days) &&
    row.days.every(isWeekday) &&
    typeof row.unit === 'string' &&
    (row.target === null || isAmount(row.target, Number.MIN_VALUE)) &&
    isStamp(row.created_at) &&
    isStamp(row.updated_at) &&
    (row.deleted_at === null || isStamp(row.deleted_at))
  )
}

/**
 * Keeps the rows the app can trust. A check-in dated after `today` (made where
 * the date has already turned) is left for a later sync.
 */
export function readRemote(habits: unknown[], checkIns: unknown[], firstDay: string, today: string): Remote {
  const records = (rows: unknown[]) =>
    rows.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
  return {
    habits: records(habits).filter(isHabitRow) as unknown as HabitRow[],
    checkIns: records(checkIns).filter(
      (row) =>
        typeof row.habit_id === 'string' &&
        typeof row.day === 'string' &&
        isDay(row.day) &&
        row.day >= firstDay &&
        row.day <= today &&
        isAmount(row.value, 0) &&
        isStamp(row.updated_at),
    ) as unknown as CheckInRow[],
  }
}

const settingsChanged = (a: Habit, b: Habit) =>
  a.name !== b.name ||
  a.category !== b.category ||
  a.unit !== b.unit ||
  a.target !== b.target ||
  a.createdAt !== b.createdAt ||
  a.days.join() !== b.days.join()

/** Stamps what a local change touched: settings, check-in days and deletions. */
export function stampChanges(before: Habit[], after: Habit[], stamps: Stamps, at: string): Stamps {
  const next: Stamps = { ...stamps, habits: { ...stamps.habits }, deleted: { ...stamps.deleted }, days: { ...stamps.days } }
  const gone = new Map(before.map((habit) => [habit.id, habit]))
  for (const habit of after) {
    const previous = gone.get(habit.id)
    gone.delete(habit.id)
    // An added or restored habit keeps its day stamps; only the habit itself is new.
    if (!previous || settingsChanged(previous, habit)) {
      next.habits[habit.id] = at
      delete next.deleted[habit.id]
    }
    if (!previous) continue
    for (const day of new Set([...Object.keys(previous.log), ...Object.keys(habit.log)])) {
      if (previous.log[day] !== habit.log[day]) next.days[habit.id] = { ...next.days[habit.id], [day]: at }
    }
  }
  for (const id of gone.keys()) {
    next.deleted[id] = at
    delete next.habits[id]
  }
  return next
}

const toRow = (habit: Habit, updatedAt: string): HabitRow => ({
  id: habit.id,
  name: habit.name,
  category: habit.category,
  days: habit.days,
  unit: habit.unit,
  target: habit.target,
  created_at: habit.createdAt,
  updated_at: updatedAt,
  deleted_at: null,
})

const fromRow = (row: HabitRow, log: Record<string, number>): Habit => ({
  id: row.id,
  name: row.name.trim(),
  category: row.category.trim() || DEFAULT_CATEGORY,
  createdAt: new Date(row.created_at).toISOString(),
  days: [...new Set(row.days)].sort(),
  unit: row.unit.trim(),
  target: row.unit.trim() ? row.target : null,
  log,
})

/**
 * Merges the account's rows into this device's habits. `now` dates check-ins
 * logged before this device kept stamps, the first time they are uploaded.
 */
export function merge(local: Habit[], stamps: Stamps, remote: Remote, now: string) {
  const next: Stamps = { ...stamps, habits: { ...stamps.habits }, deleted: { ...stamps.deleted }, days: { ...stamps.days } }
  const push: Push = { habits: [], deletions: [], checkIns: [] }
  const rows = new Map(remote.habits.map((row) => [row.id, row]))
  const checkIns = new Map<string, CheckInRow[]>()
  for (const row of remote.checkIns) checkIns.set(row.habit_id, [...(checkIns.get(row.habit_id) ?? []), row])
  const kept: Habit[] = []
  const added: Habit[] = []

  for (const habit of local) {
    const row = rows.get(habit.id)
    rows.delete(habit.id)
    if (!syncable(habit.id)) {
      kept.push(habit)
      continue
    }
    const localAt = next.habits[habit.id] ?? habit.createdAt
    if (!row || time(localAt) > time(row.updated_at)) {
      push.habits.push(toRow(habit, localAt))
      next.habits[habit.id] = localAt
      kept.push(mergeDays(habit, checkIns.get(habit.id) ?? [], next, push, now))
    } else if (adopt(row, next)) {
      kept.push(mergeDays(fromRow(row, habit.log), checkIns.get(habit.id) ?? [], next, push, now))
    }
  }

  // Deleted here: tell the server unless it has a newer version, which comes back.
  for (const [id, at] of Object.entries(stamps.deleted)) {
    const row = rows.get(id)
    if (!row) {
      // Never reached the server, or handled above: nothing to tell it.
      delete next.deleted[id]
      continue
    }
    rows.delete(id)
    if (time(at) > time(row.updated_at)) {
      if (!row.deleted_at) push.deletions.push({ id, at })
    } else if (adopt(row, next)) {
      added.push(mergeDays(fromRow(row, {}), checkIns.get(id) ?? [], next, push, now))
    }
  }

  for (const row of rows.values()) {
    if (adopt(row, next)) added.push(mergeDays(fromRow(row, {}), checkIns.get(row.id) ?? [], next, push, now))
  }

  added.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { habits: [...added, ...kept], stamps: next, push }
}

/** Takes the server's version of a habit; false when that version is deleted. */
function adopt(row: HabitRow, stamps: Stamps): boolean {
  if (row.deleted_at) {
    stamps.deleted[row.id] = row.updated_at
    delete stamps.habits[row.id]
    delete stamps.days[row.id]
    return false
  }
  stamps.habits[row.id] = row.updated_at
  delete stamps.deleted[row.id]
  return true
}

/** Day by day, the newer of this device's check-in and the server's. */
function mergeDays(habit: Habit, rows: CheckInRow[], stamps: Stamps, push: Push, now: string): Habit {
  const log = { ...habit.log }
  const dayStamps = { ...stamps.days[habit.id] }
  const remote = new Map(rows.map((row) => [row.day, row]))

  for (const day of new Set([...Object.keys(log), ...Object.keys(dayStamps), ...remote.keys()])) {
    const row = remote.get(day)
    const localAt = dayStamps[day]
    if (row && (localAt === undefined || time(localAt) <= time(row.updated_at))) {
      if (row.value > 0) log[day] = row.value
      else delete log[day]
      dayStamps[day] = row.updated_at
    } else if (row || log[day] !== undefined) {
      const at = localAt ?? now
      push.checkIns.push({ habit_id: habit.id, day, value: log[day] ?? 0, updated_at: at })
      dayStamps[day] = at
    } else {
      // Cleared here and never uploaded: nothing to tell the server.
      delete dayStamps[day]
    }
  }

  stamps.days[habit.id] = dayStamps
  return { ...habit, log }
}
