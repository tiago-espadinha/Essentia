import { DEFAULT_CATEGORY, isDay, todayKey, type Habit, type Weekday } from './habits'

export const STORAGE_KEY = 'essentia-virtus-habits'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const isWeekday = (value: unknown): value is Weekday => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6

function isHabit(value: unknown): value is Habit {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim() !== '' &&
    typeof value.category === 'string' &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    Array.isArray(value.days) &&
    value.days.every(isWeekday) &&
    typeof value.unit === 'string' &&
    (value.target === null || isAmount(value.target)) &&
    isRecord(value.log)
  )
}

// Streaks walk every day from the first logged one, so a tampered far-off date
// would stall the app; nothing can be logged before this or after today.
const FIRST_DAY = '2000-01-01'

/** Keeps only well-formed, plausible days with a positive amount. */
function cleanLog(log: Record<string, unknown>): Record<string, number> {
  const today = todayKey()
  const keep = ([day, value]: [string, unknown]) => isDay(day) && day >= FIRST_DAY && day <= today && isAmount(value)
  return Object.fromEntries(Object.entries(log).filter(keep)) as Record<
    string,
    number
  >
}

/** Reads the saved list; anything unreadable, malformed or repeated is skipped, not trusted. */
export function loadHabits(): Habit[] {
  let saved: unknown
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(saved)) return []

  const seen = new Set<string>()
  return saved.filter(isHabit).flatMap(({ id, name, category, createdAt, days, unit, target, log }) => {
    if (seen.has(id)) return []
    seen.add(id)
    return [{ id, name, category: category.trim() || DEFAULT_CATEGORY, createdAt, days, unit, target, log: cleanLog(log) }]
  })
}

/** Returns false when the browser refuses to store the list (private mode, quota). */
export function saveHabits(habits: Habit[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    return true
  } catch {
    return false
  }
}
