import { describe, expect, it } from 'vitest'
import { addDays, type Habit } from '../domain/habits'
import { groupByMonth, HISTORY_BATCH, historyOf } from '../domain/history'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    name: 'Read',
    category: 'General',
    createdAt: new Date(2021, 0, 1, 9).toISOString(),
    days: [],
    unit: '',
    target: null,
    log: {},
    ...overrides,
  }
}

describe('historyOf', () => {
  it('is empty for a habit with no logs', () => {
    expect(historyOf(habit())).toEqual([])
  })

  it('lists every logged day newest first, beyond any 30-day window', () => {
    const log = { '2021-01-05': 1, '2022-08-15': 1, '2021-12-31': 1, '2022-01-01': 1 }
    expect(historyOf(habit({ log })).map((entry) => entry.day)).toEqual(['2022-08-15', '2022-01-01', '2021-12-31', '2021-01-05'])
  })

  it('keeps the stored day keys as they are, across daylight-saving changes', () => {
    // Europe/Lisbon changes clocks on 27 March and 30 October 2022.
    const days = ['2022-03-26', '2022-03-27', '2022-03-28', '2022-10-29', '2022-10-30', '2022-10-31']
    const entries = historyOf(habit({ log: Object.fromEntries(days.map((day) => [day, 1])) }))
    expect(entries.map((entry) => entry.day)).toEqual(days.toReversed())
  })

  it('marks yes/no check-ins as done and leaves amounts without a target unmarked', () => {
    expect(historyOf(habit({ log: { '2022-08-15': 1 } }))[0]).toEqual({ day: '2022-08-15', value: 1, state: 'done' })
    expect(historyOf(habit({ unit: 'pages', log: { '2022-08-15': 3.5 } }))[0]).toEqual({ day: '2022-08-15', value: 3.5, state: null })
  })

  it('compares amounts with the target', () => {
    const entries = historyOf(habit({ unit: 'pages', target: 10, log: { '2022-08-13': 10, '2022-08-14': 9.99, '2022-08-15': 12 } }))
    expect(entries.map((entry) => [entry.value, entry.state])).toEqual([
      [12, 'met'],
      [9.99, 'below'],
      [10, 'met'],
    ])
  })

  it('never lists a zero, negative or non-finite value, which the log does not keep', () => {
    const log = { '2022-08-12': 0, '2022-08-13': -1, '2022-08-14': Number.NaN, '2022-08-15': 2 }
    expect(historyOf(habit({ unit: 'km', log })).map((entry) => entry.day)).toEqual(['2022-08-15'])
  })
})

describe('groupByMonth', () => {
  const log = { '2022-08-15': 1, '2022-08-01': 1, '2022-07-31': 1, '2021-07-31': 1 }
  const entries = historyOf(habit({ log }))

  it('groups shown entries by month and counts the whole month', () => {
    expect(groupByMonth(entries, 1)).toEqual([{ month: '2022-08', total: 2, entries: [entries[0]] }])
    expect(groupByMonth(entries, 10).map((month) => [month.month, month.total, month.entries.length])).toEqual([
      ['2022-08', 2, 2],
      ['2022-07', 1, 1],
      ['2021-07', 1, 1],
    ])
  })

  it('reveals a long history batch by batch, each log exactly once, down to the oldest', () => {
    // 2,500 consecutive days: more than two pages of the account's 1,000-row reads.
    const start = '2016-01-01'
    const long = historyOf(habit({ log: Object.fromEntries(Array.from({ length: 2500 }, (_, i) => [addDays(start, i), 1])) }))
    const batches: string[][] = []
    let previous = 0
    for (let shown = HISTORY_BATCH; previous < long.length; shown += HISTORY_BATCH) {
      const days = groupByMonth(long, shown).flatMap((month) => month.entries.map((entry) => entry.day))
      batches.push(days.slice(previous))
      previous = days.length
    }
    const all = batches.flat()
    expect(all).toHaveLength(2500)
    expect(new Set(all).size).toBe(2500)
    expect(all.at(-1)).toBe(start)
    expect(batches).toHaveLength(Math.ceil(2500 / HISTORY_BATCH))
  })
})
