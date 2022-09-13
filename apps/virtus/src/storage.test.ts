import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from './habits'
import { loadHabits, saveHabits, STORAGE_KEY } from './storage'

const valid: Habit = {
  id: 'a',
  name: 'Read',
  category: 'Learning',
  createdAt: '2022-08-15T08:00:00.000Z',
  days: [1, 3],
  unit: 'pages',
  target: 20,
  log: { '2022-08-15': 12 },
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

const store = (value: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value))

describe('habit storage', () => {
  it('starts empty when nothing is saved, with no demo habits', () => {
    expect(loadHabits()).toEqual([])
  })

  it('round-trips the list under the prefixed key', () => {
    expect(saveHabits([valid])).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([valid])
    expect(loadHabits()).toEqual([valid])
  })

  it('does not read the old unprefixed key', () => {
    localStorage.setItem('habit-tracker-data', JSON.stringify([valid]))
    expect(loadHabits()).toEqual([])
  })

  it('ignores corrupt or non-list data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadHabits()).toEqual([])
    store({ id: 'a' })
    expect(loadHabits()).toEqual([])
  })

  it('skips malformed and repeated habits and keeps the valid ones', () => {
    store([
      valid,
      null,
      { ...valid, id: 2 },
      { ...valid, id: 'b', name: ' ' },
      { ...valid, id: 'c', days: [7] },
      { ...valid, id: 'd', target: -1 },
      { ...valid, id: 'e', createdAt: 'yesterday' },
      { ...valid, id: 'f', log: [] },
      { ...valid, name: 'Repeat' },
    ])
    expect(loadHabits()).toEqual([valid])
  })

  it('drops bad log entries and falls back to the default category', () => {
    store([{ ...valid, category: ' ', log: { '2022-08-15': 3, '2022-02-30': 1, 'today': 1, '2022-08-14': 0, '2022-08-13': '2' } }])
    expect(loadHabits()).toEqual([{ ...valid, category: 'General', log: { '2022-08-15': 3 } }])
  })

  it('drops log days before 2000 or after today', () => {
    const log = { '1999-12-31': 1, '0100-01-01': 1, '2099-01-01': 1, '2022-08-15': 1 }
    store([{ ...valid, log }])
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2022, 7, 15, 9))
    try {
      expect(loadHabits()[0].log).toEqual({ '2022-08-15': 1 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a refused save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(saveHabits([valid])).toBe(false)
  })
})
