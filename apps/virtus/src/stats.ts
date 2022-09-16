// Progress figures. Like streaks, they count the days a habit is due: a bonus
// check-in on a day off adds to the totals but not to a rate, and today counts
// against a rate only once it is done.
import { addDays, daysBetween, isDone, isNumeric, isScheduled, startOf, streaks, weekdayOf, type Habit } from './habits'

export interface Tally {
  done: number
  due: number
}

/** Due days and done ones from `from` to `today`, counting only the habit's own history. */
export function tally(habit: Habit, from: string, today: string): Tally {
  const start = startOf(habit)
  let done = 0
  let due = 0
  for (const day of daysBetween(start > from ? start : from, today)) {
    if (!isScheduled(habit, day)) continue
    if (isDone(habit, day)) done++
    else if (day === today) continue
    due++
  }
  return { done, due }
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
