import { describe, expect, it } from 'vitest'
import type { Habit } from '../domain/habits'
import { addDays, daysBetween, streaks } from '../domain/habits'
import { bestStreaks, categoryTallies, checkInsSince, dayState, dayTally, heatmap, heatWeeks, percent, strength, summarize, tally, withStarts } from '../domain/stats'

// 2022-08-15 is a Monday.
const today = '2022-08-15'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    name: 'Read',
    category: 'General',
    createdAt: new Date(2022, 7, 8, 9).toISOString(),
    days: [],
    unit: '',
    target: null,
    log: {},
    ...overrides,
  }
}

const checked = (...days: string[]) => Object.fromEntries(days.map((day) => [day, 1]))

describe('tally', () => {
  it('counts due days since the habit started, leaving an open today out', () => {
    // Created on the 8th: 7 due days before today.
    expect(tally(habit({ log: checked('2022-08-13', '2022-08-14') }), '2022-08-01', today)).toEqual({ done: 2, due: 7 })
  })

  it('counts today once it is done', () => {
    expect(tally(habit({ log: checked(today) }), '2022-08-15', today)).toEqual({ done: 1, due: 1 })
  })

  it('counts only scheduled days and leaves bonus check-ins out', () => {
    // Mon/Wed/Fri from the 8th: the 8th, 10th and 12th; the 13th is a bonus.
    const custom = habit({ days: [1, 3, 5], log: checked('2022-08-08', '2022-08-13') })
    expect(tally(custom, '2022-08-01', today)).toEqual({ done: 1, due: 3 })
  })

  it('counts a numeric day only at its target', () => {
    const pages = habit({ unit: 'pages', target: 20, log: { '2022-08-13': 25, '2022-08-14': 5 } })
    expect(tally(pages, '2022-08-13', today)).toEqual({ done: 1, due: 2 })
  })

  it('rounds to a percent, or null with nothing due', () => {
    expect(percent({ done: 2, due: 3 })).toBe(67)
    expect(percent({ done: 0, due: 0 })).toBeNull()
  })
})

describe('summarize', () => {
  it('collects streaks, check-ins, the last 30 days and weekday counts', () => {
    const summary = summarize(habit({ log: checked('2022-08-13', '2022-08-14', today) }), today)
    expect(summary).toMatchObject({ current: 3, longest: 3, checkIns: 3, last30: { done: 3, due: 8 }, amounts: null })
    // Saturday, Sunday and Monday.
    expect(summary.byWeekday).toEqual([1, 1, 0, 0, 0, 0, 1])
  })

  it('adds amounts for a numeric habit', () => {
    const summary = summarize(habit({ unit: 'pages', log: { '2022-08-13': 10, '2022-08-14': 25 } }), today)
    expect(summary.amounts).toEqual({ total: 35, average: 17.5, best: 25 })
  })
})

describe('dayState', () => {
  const custom = habit({ days: [1, 3, 5], log: checked('2022-08-10', '2022-08-13') })

  it('reads each kind of day', () => {
    expect(dayState(custom, '2022-08-10', today)).toBe('done')
    expect(dayState(custom, '2022-08-12', today)).toBe('missed')
    expect(dayState(custom, '2022-08-11', today)).toBe('off')
    expect(dayState(custom, '2022-08-13', today)).toBe('done')
    expect(dayState(custom, today, today)).toBe('open')
    expect(dayState(custom, '2022-08-17', today)).toBe('later')
    expect(dayState(custom, '2022-08-01', today)).toBe('off')
  })
})

describe('dashboard figures', () => {
  const daily = habit({ id: 'a', category: 'Health', log: checked('2022-08-13', '2022-08-14') })
  const weekend = habit({ id: 'b', category: 'Social', days: [0, 6], log: checked('2022-08-13') })

  it('tallies one day across habits', () => {
    const started = withStarts([daily, weekend])
    expect(dayTally(started, '2022-08-14', today)).toEqual({ done: 1, due: 2 })
    expect(dayTally(started, today, today)).toEqual({ done: 0, due: 0 })
  })

  it('builds twelve Monday-first weeks with a level per day', () => {
    const days = heatmap([daily, weekend], today)
    expect(days).toHaveLength(84)
    expect(days[0].day).toBe('2022-05-30')
    expect(days.at(-1)!.day).toBe('2022-08-21')
    const level = (day: string) => days.find((item) => item.day === day)!.level
    expect(level('2022-08-13')).toBe(4)
    expect(level('2022-08-14')).toBe(2)
    expect(level('2022-08-09')).toBe(0)
    expect(level('2022-08-01')).toBeNull()
    expect(level(today)).toBeNull()
    expect(level('2022-08-20')).toBeNull()
  })

  it('sums the heatmap by week, for its table', () => {
    const weeks = heatWeeks(heatmap([daily, weekend], today))
    expect(weeks).toHaveLength(12)
    expect(weeks[0]).toEqual({ start: '2022-05-30', tally: { done: 0, due: 0 }, full: 0 })
    // Both created on 8 August: the daily habit 2 of 7, the weekend one 1 of 2; only the 13th has both.
    expect(weeks.at(-2)).toEqual({ start: '2022-08-08', tally: { done: 3, due: 9 }, full: 1 })
    expect(weeks.at(-1)).toEqual({ start: today, tally: { done: 0, due: 0 }, full: 0 })
  })

  it('tallies by category and finds the best streaks', () => {
    expect(categoryTallies([daily, weekend], '2022-08-01', today)).toEqual([
      { category: 'Health', tally: { done: 2, due: 7 } },
      { category: 'Social', tally: { done: 1, due: 2 } },
    ])
    const best = bestStreaks([daily, weekend], today)
    expect(best.current).toMatchObject({ habit: { id: 'a' }, days: 2 })
    expect(best.longest).toMatchObject({ habit: { id: 'a' }, days: 2 })
    expect(bestStreaks([], today)).toEqual({ current: null, longest: null })
  })

  it('counts check-ins in a range', () => {
    expect(checkInsSince([daily, weekend], '2022-08-14', today)).toBe(1)
    expect(checkInsSince([daily, weekend], '2022-08-01', today)).toBe(3)
  })
})

describe('strength', () => {
  // The worked examples of the score proposal: 30 days to Sunday 2023-05-28, Sundays as bonus days.
  const end = '2023-05-28'
  const first = addDays(end, -29)
  const month = daysBetween(first, end)
  const started = (overrides: Partial<Habit>, from = first) =>
    habit({ createdAt: new Date(`${from}T09:00`).toISOString(), ...overrides })
  /** One log entry for each day `amount` returns a value for, by day index. */
  const logBy = (amount: (index: number, day: string) => number | null, days = month): Habit['log'] => {
    const log: Habit['log'] = {}
    days.forEach((day, index) => {
      const value = amount(index, day)
      if (value !== null) log[day] = value
    })
    return log
  }
  const on = (...weekdays: number[]) => (_: number, day: string) => (weekdays.includes(new Date(`${day}T12:00`).getDay()) ? 1 : null)
  const glasses = { unit: 'glasses', target: 8 }

  const cases: [string, Habit, { current: number; longest: number }, number | null][] = [
    ['daily, never missed', started({ log: logBy(() => 1) }), { current: 30, longest: 30 }, 100],
    ['daily, one miss 3 days ago', started({ log: logBy((i) => (i === 26 ? null : 1)) }), { current: 3, longest: 26 }, 95],
    ['daily, one miss 25 days ago', started({ log: logBy((i) => (i === 4 ? null : 1)) }), { current: 25, longest: 25 }, 98],
    ['daily, 20 done then 10 missed', started({ log: logBy((i) => (i < 20 ? 1 : null)) }), { current: 0, longest: 20 }, 53],
    ['daily, 10 missed then 20 done', started({ log: logBy((i) => (i >= 10 ? 1 : null)) }), { current: 20, longest: 20 }, 81],
    ['Mon/Wed/Fri, every due day done', started({ days: [1, 3, 5], log: logBy(on(1, 3, 5)) }), { current: 12, longest: 12 }, 100],
    ['Mon/Wed/Fri plus bonus Sundays', started({ days: [1, 3, 5], log: logBy(on(0, 1, 3, 5)) }), { current: 12, longest: 12 }, 100],
    ['8 glasses, 6 most days and 8 every third', started({ ...glasses, log: logBy((i) => (i % 3 === 0 ? 8 : 6)) }), { current: 0, longest: 1 }, 83],
    ['8 glasses every day', started({ ...glasses, log: logBy(() => 8) }), { current: 30, longest: 30 }, 100],
    ['numeric without a target, any amount', started({ unit: 'pages', log: logBy((i) => 1 + (i % 5)) }), { current: 30, longest: 30 }, 100],
    ['new habit, 3 days, all done', started({ log: logBy(() => 1, month.slice(-3)) }, addDays(end, -2)), { current: 3, longest: 3 }, null],
    ['daily, every other day', started({ log: logBy((i) => (i % 2 === 0 ? 1 : null)) }), { current: 1, longest: 1 }, 52],
  ]

  it.each(cases)('scores %s as in the proposal', (_, subject, runs, expected) => {
    // The streaks pin each fixture to the proposal's table before the score is read.
    expect(streaks(subject, end)).toEqual(runs)
    expect(strength(subject, end)).toBe(expected)
  })

  it('leaves an open today out and counts it once done', () => {
    const week = daysBetween(addDays(end, -7), addDays(end, -1))
    const open = started({ log: logBy(() => 1, week) }, week[0])
    expect(strength(open, end)).toBe(100)
    // Once done, today is the newest due day: a missed week before it still shows.
    const late = started({ log: { [end]: 1 } }, week[0])
    expect(strength(late, end)).toBe(15)
  })

  it('gives a bonus day nothing', () => {
    const weekdays = started({ days: [1, 2, 3, 4, 5], log: logBy(on(0)) })
    expect(strength(weekdays, end)).toBe(0)
  })

  it('needs 7 due days, counting only scheduled ones', () => {
    expect(strength(started({ log: logBy(() => 1, month.slice(-6)) }, addDays(end, -5)), end)).toBeNull()
    expect(strength(started({ log: logBy(() => 1, month.slice(-7)) }, addDays(end, -6)), end)).toBe(100)
    // Mon/Wed/Fri over two weeks: six due days.
    expect(strength(started({ days: [1, 3, 5] }, addDays(end, -13)), end)).toBeNull()
  })

  it('weighs a recent miss more than an old one', () => {
    const recent = started({ log: logBy((i) => (i === 28 ? null : 1)) })
    const old = started({ log: logBy((i) => (i === 1 ? null : 1)) })
    expect(strength(recent, end)!).toBeLessThan(strength(old, end)!)
  })
})
