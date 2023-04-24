import { afterEach, describe, expect, it } from 'vitest'
import {
  createRecurring,
  nextAfter,
  nextOnWeekday,
  occurrence,
  readRecurring,
  RECURRING_CODEC,
  setPaused,
  weekdayOf,
  type RecurringFields,
} from '../domain/recurring'
import { loadRecurring, NO_RECURRING, RECURRING_KEY, save } from '../data/storage'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const T1 = '2022-12-12T10:00:00.000Z'

const rent: RecurringFields = {
  description: 'Rent',
  amount: 90000,
  type: 'expense',
  category: 'housing',
  frequency: 'monthly',
  startOn: '2023-01-31',
}

const steps = (start: string, frequency: RecurringFields['frequency'], count: number) =>
  Array.from({ length: count }, (_, n) => occurrence(start, frequency, n))

describe('date steps', () => {
  it('lands a month-end item on the last day of shorter months and returns to its day after', () => {
    expect(steps('2023-01-31', 'monthly', 4)).toEqual(['2023-01-31', '2023-02-28', '2023-03-31', '2023-04-30'])
    expect(steps('2024-01-31', 'monthly', 3)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31'])
    expect(steps('2022-11-30', 'monthly', 4)).toEqual(['2022-11-30', '2022-12-30', '2023-01-30', '2023-02-28'])
  })

  it('crosses the year end', () => {
    expect(steps('2022-12-15', 'monthly', 2)).toEqual(['2022-12-15', '2023-01-15'])
    expect(steps('2022-12-28', 'weekly', 3)).toEqual(['2022-12-28', '2023-01-04', '2023-01-11'])
  })

  it('keeps a yearly Feb 29 on Feb 28 in common years and on Feb 29 in leap years', () => {
    expect(steps('2020-02-29', 'yearly', 5)).toEqual(['2020-02-29', '2021-02-28', '2022-02-28', '2023-02-28', '2024-02-29'])
  })

  it('names the first occurrence after today', () => {
    expect(nextAfter({ startOn: '2023-01-31', frequency: 'monthly' }, '2023-02-27')).toBe('2023-02-28')
    expect(nextAfter({ startOn: '2023-01-31', frequency: 'monthly' }, '2023-02-28')).toBe('2023-03-31')
    expect(nextAfter({ startOn: '2023-01-31', frequency: 'monthly' }, '2022-12-12')).toBe('2023-01-31')
    expect(nextAfter({ startOn: '2023-01-31', frequency: 'monthly' }, '2023-01-31')).toBe('2023-02-28')
    expect(nextAfter({ startOn: '2002-01-07', frequency: 'weekly' }, '2022-12-12')).toBe('2022-12-19')
    expect(nextAfter({ startOn: '2020-02-29', frequency: 'yearly' }, '2023-03-01')).toBe('2024-02-29')
  })
})

describe('weekdays', () => {
  it('names the day of the week a day falls on, whatever the device time zone', () => {
    expect(['2023-04-24', '2023-04-30', '2022-12-31', '2023-01-01', '2024-02-29'].map(weekdayOf)).toEqual([1, 0, 6, 0, 4])
  })

  it('finds the next day on a weekday, keeping a day already on it', () => {
    expect(nextOnWeekday('2023-04-24', 1)).toBe('2023-04-24')
    expect(nextOnWeekday('2023-04-26', 1)).toBe('2023-05-01')
    expect(nextOnWeekday('2022-12-29', 1)).toBe('2023-01-02')
    expect(nextOnWeekday('2024-02-27', 4)).toBe('2024-02-29')
    expect(nextOnWeekday('2023-02-27', 3)).toBe('2023-03-01')
  })

  it('keeps every weekly occurrence on the start weekday, seven days apart, across months and years', () => {
    const days = steps('2022-12-20', 'weekly', 64)
    expect(new Set(days.map(weekdayOf))).toEqual(new Set([2]))
    expect(days.slice(1).every((day, n) => Date.parse(day) - Date.parse(days[n]) === 7 * 86_400_000)).toBe(true)
    expect(days.slice(1, 3)).toEqual(['2022-12-27', '2023-01-03'])
    expect(days.filter((day) => day.startsWith('2024-02'))).toEqual(['2024-02-06', '2024-02-13', '2024-02-20', '2024-02-27'])
  })
})

describe('pausing', () => {
  it('stops an item, and resuming starts again from today', () => {
    const item = createRecurring(rent, new Date(T1), ID)
    const paused = setPaused(item, true, '2023-02-10', new Date('2023-02-10T09:00:00Z'))
    expect(paused).toMatchObject({ paused: true, pausedOn: '2023-02-10', resumedOn: null, updatedAt: '2023-02-10T09:00:00.000Z' })
    expect(setPaused(paused, false, '2023-04-02')).toMatchObject({
      paused: false,
      pausedOn: '2023-02-10',
      resumedOn: '2023-04-02',
    })
  })
})

describe('recurring rows', () => {
  const item = createRecurring(rent, new Date(T1), ID)

  it('round-trips through the codec, in euros on the server', () => {
    const row = RECURRING_CODEC.toRow(item)
    expect(row).toMatchObject({ amount: 900, start_on: '2023-01-31', resumed_on: null, deleted_at: null })
    expect(RECURRING_CODEC.fromRow(row)).toEqual(item)
    expect(readRecurring([{ ...row, amount: '900.00', category: ' Housing ' }])).toEqual([row])
  })

  it('skips rows it cannot trust', () => {
    const row = RECURRING_CODEC.toRow(item)
    expect(
      readRecurring([
        null,
        { ...row, frequency: 'daily' },
        { ...row, start_on: '2023-02-30' },
        { ...row, paused: 'no' },
        { ...row, paused_on: 3 },
        { ...row, id: 'x' },
      ]),
    ).toEqual([])
  })
})

describe('recurring storage', () => {
  afterEach(() => localStorage.clear())

  it('round-trips the items and pending deletions, and skips malformed ones', () => {
    const item = createRecurring(rent, new Date(T1), ID)
    const saved = { items: [item], deleted: { other: T1 } }
    expect(save(RECURRING_KEY, saved)).toBe(true)
    expect(loadRecurring()).toEqual(saved)
    localStorage.setItem(
      RECURRING_KEY,
      JSON.stringify({ items: [item, item, { ...item, id: 'b', frequency: 'daily' }], deleted: {} }),
    )
    expect(loadRecurring()).toEqual({ items: [item], deleted: {} })
    localStorage.setItem(RECURRING_KEY, 'nope')
    expect(loadRecurring()).toEqual(NO_RECURRING)
  })
})
