// The habit model and the pure rules around it. Days are local calendar days
// ('YYYY-MM-DD'), so comparing them as strings orders them correctly; the
// rules take `today` as an argument instead of reading the clock.

/** 0 = Sunday … 6 = Saturday, as `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Habit {
  id: string
  name: string
  category: string
  /** ISO timestamp; orders the list and starts the habit's history. */
  createdAt: string
  /** Days the habit is due; empty means every day. */
  days: Weekday[]
  /** '' for a yes/no habit; otherwise the unit a numeric habit is logged in. */
  unit: string
  /** Daily amount a numeric habit needs to count as done, or null for any amount. */
  target: number | null
  /** Logged value per day: 1 for a yes/no check-in, the amount for a numeric one. */
  log: Record<string, number>
}

export interface HabitDraft {
  name: string
  category: string
  days: Weekday[]
  unit: string
  target: number | null
}

export const DEFAULT_CATEGORY = 'General'

/** Monday first, as the week view and the hero read. */
export const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/** The local calendar day of a moment (not `toISOString`, which is UTC). */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayKey(): string {
  return dayKey(new Date())
}

// Day arithmetic runs on UTC midnights, so daylight-saving changes never skip or repeat a day.
function toUtc(day: string): number {
  const [, year, month, date] = DAY.exec(day)!
  return Date.UTC(Number(year), Number(month) - 1, Number(date))
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function isDay(value: string): boolean {
  return DAY.test(value) && fromUtc(toUtc(value)) === value
}

export function addDays(day: string, amount: number): string {
  return fromUtc(toUtc(day) + amount * MS_PER_DAY)
}

export function weekdayOf(day: string): Weekday {
  return new Date(toUtc(day)).getUTCDay() as Weekday
}

/** Days from `start` to `end`, both included; empty when `start` is later. */
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

/** Monday to Sunday of the week holding `day`. */
export function weekOf(day: string): string[] {
  const monday = addDays(day, -((weekdayOf(day) + 6) % 7))
  return daysBetween(monday, addDays(monday, 6))
}

/**
 * A random id. `crypto.randomUUID` exists only in secure contexts (https or
 * localhost), so plain-http LAN testing falls back to `getRandomValues`.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The id of a row's first control, so focus can be handed to a row after it re-renders. */
export const controlId = (habit: Habit) => `habit-${habit.id}-control`

export const editId = (habit: Habit) => `habit-${habit.id}-edit`
export const statsId = (habit: Habit) => `habit-${habit.id}-stats`

export const isNumeric = (habit: Pick<Habit, 'unit'>) => habit.unit !== ''

export function isScheduled(habit: Habit, day: string): boolean {
  return habit.days.length === 0 || habit.days.includes(weekdayOf(day))
}

/** A numeric habit is done once it reaches its target; without one, any amount counts. */
export function isDone(habit: Habit, day: string): boolean {
  const value = habit.log[day] ?? 0
  return habit.target !== null && isNumeric(habit) ? value >= habit.target : value > 0
}

/** The first day of the habit's history: its creation day, or an earlier logged day. */
export function startOf(habit: Habit): string {
  const created = dayKey(new Date(habit.createdAt))
  return Object.keys(habit.log).reduce((first, day) => (day < first ? day : first), created)
}

/**
 * Current and longest run of scheduled days done, up to today. Unscheduled days
 * are skipped, even when checked in; a scheduled day missed breaks the run, except
 * today, which is still open.
 */
export function streaks(habit: Habit, today: string): { current: number; longest: number } {
  let current = 0
  let longest = 0
  for (const day of daysBetween(startOf(habit), today)) {
    if (!isScheduled(habit, day)) continue
    if (isDone(habit, day)) current++
    else if (day !== today) current = 0
    longest = Math.max(longest, current)
  }
  return { current, longest }
}

/** Streak lengths worth a quiet note in the row. */
export const MILESTONES = [3, 7, 30, 100]

/** Days to store for a draft, sorted Sunday first; all seven means every day. */
function normalizeDays(days: Weekday[]): Weekday[] {
  const unique = [...new Set(days)].sort()
  return unique.length === 7 ? [] : unique
}

function normalizeTarget(draft: HabitDraft): number | null {
  const unit = draft.unit.trim()
  return unit && draft.target !== null && Number.isFinite(draft.target) && draft.target > 0 ? draft.target : null
}

export function createHabit(draft: HabitDraft, now: Date = new Date(), id: string = newId()): Habit | null {
  const name = draft.name.trim()
  if (!name) return null
  return {
    id,
    name,
    category: draft.category.trim() || DEFAULT_CATEGORY,
    createdAt: now.toISOString(),
    days: normalizeDays(draft.days),
    unit: draft.unit.trim(),
    target: normalizeTarget(draft),
    log: {},
  }
}

/** Applies an edit; returns null when the draft has no name to save. The log is kept. */
export function applyDraft(habit: Habit, draft: HabitDraft): Habit | null {
  const name = draft.name.trim()
  if (!name) return null
  return {
    ...habit,
    name,
    category: draft.category.trim() || DEFAULT_CATEGORY,
    days: normalizeDays(draft.days),
    unit: draft.unit.trim(),
    target: normalizeTarget(draft),
  }
}

/** Sets a day's logged value; zero or less clears it. */
export function logValue(habit: Habit, day: string, value: number): Habit {
  const log = { ...habit.log }
  if (value > 0 && Number.isFinite(value)) log[day] = value
  else delete log[day]
  return { ...habit, log }
}

/** Checks a yes/no habit in for the day, or clears the check-in. */
export function toggleDay(habit: Habit, day: string): Habit {
  return logValue(habit, day, habit.log[day] ? 0 : 1)
}

/** 'Mon, Wed, Fri', or 'Every day'. */
export function describeDays(days: Weekday[]): string {
  if (days.length === 0) return 'Every day'
  return WEEK.filter((day) => days.includes(day))
    .map((day) => WEEKDAY_NAMES[day].slice(0, 3))
    .join(', ')
}

export function categoriesOf(habits: Habit[]): string[] {
  return [...new Set(habits.map((habit) => habit.category))].sort((a, b) => a.localeCompare(b))
}

export type SortMode = 'newest' | 'streak' | 'name'

export const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest first',
  streak: 'Longest streak',
  name: 'Name',
}

export interface ListQuery {
  search: string
  category: string | null
  sort: SortMode
}

export function queryHabits(habits: Habit[], query: ListQuery, today: string): Habit[] {
  const search = query.search.trim().toLowerCase()
  const matches = habits.filter(
    (habit) =>
      (query.category === null || habit.category === query.category) &&
      (!search || habit.name.toLowerCase().includes(search) || habit.category.toLowerCase().includes(search)),
  )
  switch (query.sort) {
    case 'name':
      return matches.toSorted((a, b) => a.name.localeCompare(b.name))
    case 'streak': {
      const current = new Map(matches.map((habit) => [habit.id, streaks(habit, today).current]))
      return matches.toSorted((a, b) => current.get(b.id)! - current.get(a.id)!)
    }
    default:
      return matches.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export interface TodayGroups {
  due: Habit[]
  done: Habit[]
  notDue: Habit[]
}

/**
 * Splits the list for today: due and still open, done (including a bonus
 * check-in on a day off), and not due today. Each group keeps the list order.
 */
export function groupForToday(habits: Habit[], today: string): TodayGroups {
  const groups: TodayGroups = { due: [], done: [], notDue: [] }
  for (const habit of habits) {
    if (isDone(habit, today)) groups.done.push(habit)
    else if (isScheduled(habit, today)) groups.due.push(habit)
    else groups.notDue.push(habit)
  }
  return groups
}
