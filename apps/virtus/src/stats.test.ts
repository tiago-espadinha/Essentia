import { describe, expect, it } from 'vitest'
import type { Habit } from './habits'
import { bestStreaks, categoryTallies, checkInsSince, dayState, dayTally, heatmap, percent, summarize, tally, withStarts } from './stats'

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
