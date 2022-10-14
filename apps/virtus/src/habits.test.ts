import { describe, expect, it } from 'vitest'
import {
  addDays,
  applyDraft,
  createHabit,
  dayKey,
  daysBetween,
  describeDays,
  isDay,
  isDone,
  logValue,
  newId,
  queryHabits,
  streaks,
  toggleDay,
  weekOf,
  type Habit,
  type HabitDraft,
} from './habits'

// 2022-08-15 is a Monday.
const draft: HabitDraft = { name: 'Read', category: '', days: [], unit: '', target: null }

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    name: 'Read',
    category: 'General',
    createdAt: new Date(2022, 7, 1, 9).toISOString(),
    days: [],
    unit: '',
    target: null,
    log: {},
    ...overrides,
  }
}

const checked = (...days: string[]) => Object.fromEntries(days.map((day) => [day, 1]))

describe('days', () => {
  it('keys a moment by its local calendar day, not by UTC', () => {
    // 23:30 local is already the next day in UTC for any zone east of UTC+0:30,
    // and 00:15 local is still the previous day west of UTC.
    expect(dayKey(new Date(2022, 7, 15, 23, 30))).toBe('2022-08-15')
    expect(dayKey(new Date(2022, 7, 16, 0, 15))).toBe('2022-08-16')
  })

  it('adds days across month, year and daylight-saving changes', () => {
    expect(addDays('2022-08-31', 1)).toBe('2022-09-01')
    expect(addDays('2023-01-01', -1)).toBe('2022-12-31')
    expect(addDays('2022-03-27', 1)).toBe('2022-03-28')
    expect(daysBetween('2022-10-29', '2022-10-31')).toEqual(['2022-10-29', '2022-10-30', '2022-10-31'])
  })

  it('validates calendar days', () => {
    expect(isDay('2022-02-28')).toBe(true)
    expect(isDay('2022-02-30')).toBe(false)
    expect(isDay('2022-8-1')).toBe(false)
  })

  it('gives the Monday-to-Sunday week of a day', () => {
    expect(weekOf('2022-08-17')).toEqual(daysBetween('2022-08-15', '2022-08-21'))
    expect(weekOf('2022-08-21')[0]).toBe('2022-08-15')
  })

  it('describes the schedule', () => {
    expect(describeDays([])).toBe('Every day')
    expect(describeDays([0, 1, 5])).toBe('Mon, Fri, Sun')
  })
})

describe('streaks', () => {
  const today = '2022-08-15'

  it('counts consecutive days for a daily habit', () => {
    const run = habit({ log: checked('2022-08-12', '2022-08-13', '2022-08-14', today) })
    expect(streaks(run, today)).toEqual({ current: 4, longest: 4 })
  })

  it('keeps the streak while today is still open', () => {
    const run = habit({ log: checked('2022-08-13', '2022-08-14') })
    expect(streaks(run, today).current).toBe(2)
  })

  it('breaks on a missed scheduled day and remembers the longest run', () => {
    const run = habit({ log: checked('2022-08-08', '2022-08-09', '2022-08-10', '2022-08-12', '2022-08-13', '2022-08-14') })
    expect(streaks(run, today)).toEqual({ current: 3, longest: 3 })
    expect(streaks(habit({ log: checked('2022-08-10', '2022-08-11', '2022-08-12') }), today).current).toBe(0)
  })

  it('skips unscheduled days for a custom schedule', () => {
    // Mon, Wed, Fri: the weekend and Tuesday/Thursday neither count nor break.
    const run = habit({ days: [1, 3, 5], log: checked('2022-08-08', '2022-08-10', '2022-08-12', today) })
    expect(streaks(run, today)).toEqual({ current: 4, longest: 4 })
  })

  it('breaks a custom schedule on a missed scheduled day', () => {
    const run = habit({ days: [1, 3, 5], log: checked('2022-08-08', '2022-08-12') })
    expect(streaks(run, today)).toEqual({ current: 1, longest: 1 })
  })

  it('does not add bonus check-ins on unscheduled days to the streak', () => {
    const run = habit({ days: [1, 3, 5], log: checked('2022-08-12', '2022-08-13', '2022-08-14') })
    expect(streaks(run, today).current).toBe(1)
  })

  it('counts a numeric day only once it reaches the target', () => {
    const pages = habit({ unit: 'pages', target: 20, log: { '2022-08-13': 25, '2022-08-14': 12 } })
    expect(isDone(pages, '2022-08-13')).toBe(true)
    expect(isDone(pages, '2022-08-14')).toBe(false)
    expect(streaks(pages, today).current).toBe(0)
    expect(isDone({ ...pages, target: null }, '2022-08-14')).toBe(true)
  })

  it('is zero for a new habit', () => {
    expect(streaks(habit({ createdAt: new Date(2022, 7, 15, 8).toISOString() }), today)).toEqual({ current: 0, longest: 0 })
  })
})

describe('creating and editing', () => {
  const now = new Date(2022, 7, 15, 9)

  it('creates a trimmed yes/no habit in the default category', () => {
    expect(createHabit({ ...draft, name: '  Stretch ' }, now, 'a')).toEqual({
      id: 'a',
      name: 'Stretch',
      category: 'General',
      createdAt: now.toISOString(),
      days: [],
      unit: '',
      target: null,
      log: {},
    })
  })

  it('refuses a habit without a name', () => {
    expect(createHabit({ ...draft, name: '  ' }, now)).toBeNull()
  })

  it('stores a full week as every day and keeps a target only for numeric habits', () => {
    expect(createHabit({ ...draft, days: [0, 1, 2, 3, 4, 5, 6] }, now)!.days).toEqual([])
    expect(createHabit({ ...draft, days: [5, 1, 1] }, now)!.days).toEqual([1, 5])
    expect(createHabit({ ...draft, target: 20 }, now)!.target).toBeNull()
    expect(createHabit({ ...draft, unit: 'pages', target: 0 }, now)!.target).toBeNull()
    expect(createHabit({ ...draft, unit: ' pages ', target: 20 }, now)).toMatchObject({ unit: 'pages', target: 20 })
  })

  it('edits the settings and keeps the log', () => {
    const edited = applyDraft(habit({ log: checked('2022-08-14') }), { ...draft, name: 'Read more', category: 'Learning', days: [1] })
    expect(edited).toMatchObject({ name: 'Read more', category: 'Learning', days: [1], log: checked('2022-08-14') })
    expect(applyDraft(habit(), { ...draft, name: '' })).toBeNull()
  })

  it('toggles a check-in and clears a logged value at zero', () => {
    const on = toggleDay(habit(), '2022-08-15')
    expect(on.log).toEqual({ '2022-08-15': 1 })
    expect(toggleDay(on, '2022-08-15').log).toEqual({})
    expect(logValue(habit(), '2022-08-15', 12).log).toEqual({ '2022-08-15': 12 })
    expect(logValue(habit({ log: { '2022-08-15': 12 } }), '2022-08-15', 0).log).toEqual({})
  })

  it('makes an id outside a secure context', () => {
    const randomUUID = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: randomUUID, configurable: true })
    }
  })
})

describe('querying', () => {
  const today = '2022-08-15'
  const list = [
    habit({ id: 'a', name: 'Run', category: 'Fitness', createdAt: '2022-08-01T08:00:00.000Z' }),
    habit({ id: 'b', name: 'Meditate', category: 'Mindfulness', createdAt: '2022-08-03T08:00:00.000Z', log: checked('2022-08-14') }),
    habit({ id: 'c', name: 'Journal', category: 'Mindfulness', createdAt: '2022-08-02T08:00:00.000Z' }),
  ]
  const ids = (habits: Habit[]) => habits.map((item) => item.id)

  it('sorts newest first, by name or by current streak', () => {
    expect(ids(queryHabits(list, { search: '', category: null, sort: 'newest' }, today))).toEqual(['b', 'c', 'a'])
    expect(ids(queryHabits(list, { search: '', category: null, sort: 'name' }, today))).toEqual(['c', 'b', 'a'])
    expect(ids(queryHabits(list, { search: '', category: null, sort: 'streak' }, today))[0]).toBe('b')
  })

  it('filters by category and searches names and categories', () => {
    expect(ids(queryHabits(list, { search: '', category: 'Mindfulness', sort: 'name' }, today))).toEqual(['c', 'b'])
    expect(ids(queryHabits(list, { search: 'RUN', category: null, sort: 'name' }, today))).toEqual(['a'])
    expect(ids(queryHabits(list, { search: 'fit', category: null, sort: 'name' }, today))).toEqual(['a'])
  })
})
