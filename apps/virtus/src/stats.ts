// Progress figures. Like streaks, they count the days a habit is due: a bonus
// check-in on a day off adds to the totals but not to a rate, and today counts
// against a rate only once it is done.
import { addDays, categoriesOf, daysBetween, isDone, isNumeric, isScheduled, startOf, streaks, weekdayOf, weekOf, type Habit } from './habits'

export interface Tally {
  done: number
  due: number
}

/** A habit with its first day worked out once; `startOf` scans the whole log. */
export interface Started {
  habit: Habit
  start: string
}

export const withStarts = (habits: Habit[]): Started[] => habits.map((habit) => ({ habit, start: startOf(habit) }))

/** Adds one day of a habit to a tally: only due days count, and an open today does not. */
function count(into: Tally, { habit, start }: Started, day: string, today: string) {
  if (day < start || !isScheduled(habit, day)) return
  if (isDone(habit, day)) {
    into.done++
    into.due++
  } else if (day !== today) {
    into.due++
  }
}

/** Due days and done ones from `from` to `today`, counting only the habit's own history. */
export function tally(habit: Habit, from: string, today: string): Tally {
  const sum = { done: 0, due: 0 }
  const started = { habit, start: startOf(habit) }
  for (const day of daysBetween(from, today)) count(sum, started, day, today)
  return sum
}

/** One day across every habit. */
export function dayTally(habits: Started[], day: string, today: string): Tally {
  const sum = { done: 0, due: 0 }
  for (const started of habits) count(sum, started, day, today)
  return sum
}

export function sumTallies(tallies: Tally[]): Tally {
  return tallies.reduce((sum, item) => ({ done: sum.done + item.done, due: sum.due + item.due }), { done: 0, due: 0 })
}

/** Whole percent, or null with nothing due yet. */
export function percent({ done, due }: Tally): number | null {
  return due === 0 ? null : Math.round((done / due) * 100)
}

export interface HabitSummary {
  current: number
  longest: number
  /** Days with anything logged, bonus days included. */
  checkIns: number
  last30: Tally
  /** Check-ins per weekday, Sunday first. */
  byWeekday: number[]
  /** Numeric habits only: total, average per logged day and best day. */
  amounts: { total: number; average: number; best: number } | null
}

export function summarize(habit: Habit, today: string): HabitSummary {
  const byWeekday = [0, 0, 0, 0, 0, 0, 0]
  for (const day of Object.keys(habit.log)) byWeekday[weekdayOf(day)]++
  const values = Object.values(habit.log)
  const total = values.reduce((sum, value) => sum + value, 0)

  return {
    ...streaks(habit, today),
    checkIns: values.length,
    last30: tally(habit, addDays(today, -29), today),
    byWeekday,
    amounts:
      isNumeric(habit) && values.length > 0 ? { total, average: total / values.length, best: Math.max(...values) } : null,
  }
}

export type DayState = 'done' | 'missed' | 'open' | 'off' | 'later'

/** How a day reads in the week view and the 30-day strip. */
export function dayState(habit: Habit, day: string, today: string): DayState {
  if (day > today) return 'later'
  if (isDone(habit, day)) return 'done'
  if (!isScheduled(habit, day) || day < startOf(habit)) return 'off'
  return day === today ? 'open' : 'missed'
}

export const DAY_STATE_LABELS: Record<DayState, string> = {
  done: 'done',
  missed: 'missed',
  open: 'not yet',
  off: 'not due',
  later: 'upcoming',
}

export interface HeatDay {
  day: string
  tally: Tally
  /** 0 (none done) to 4 (all done); null with nothing due, or for a later day. */
  level: 0 | 1 | 2 | 3 | 4 | null
}

/** Twelve whole weeks, Monday to Sunday, ending with this one. */
export function heatmap(habits: Habit[], today: string): HeatDay[] {
  const first = weekOf(addDays(today, -7 * 11))[0]
  const started = withStarts(habits)
  return daysBetween(first, addDays(first, 83)).map((day) => {
    const dayTotal = day > today ? { done: 0, due: 0 } : dayTally(started, day, today)
    const share = dayTotal.due === 0 ? null : dayTotal.done / dayTotal.due
    return { day, tally: dayTotal, level: share === null ? null : (Math.ceil(share * 4) as HeatDay['level']) }
  })
}

export function categoryTallies(habits: Habit[], from: string, today: string): { category: string; tally: Tally }[] {
  return categoriesOf(habits).map((category) => ({
    category,
    tally: sumTallies(habits.filter((habit) => habit.category === category).map((habit) => tally(habit, from, today))),
  }))
}

/** The habit with the longest current, and the longest ever, streak; null without habits. */
export function bestStreaks(habits: Habit[], today: string) {
  let current: { habit: Habit; days: number } | null = null
  let longest: { habit: Habit; days: number } | null = null
  for (const habit of habits) {
    const runs = streaks(habit, today)
    if (!current || runs.current > current.days) current = { habit, days: runs.current }
    if (!longest || runs.longest > longest.days) longest = { habit, days: runs.longest }
  }
  return { current, longest }
}

/** Check-ins (any logged day, bonus days included) from `from` to `today`. */
export function checkInsSince(habits: Habit[], from: string, today: string): number {
  return habits.reduce((sum, habit) => sum + Object.keys(habit.log).filter((day) => day >= from && day <= today).length, 0)
}
