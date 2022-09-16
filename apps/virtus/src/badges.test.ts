import { describe, expect, it } from 'vitest'
import { badges } from './badges'
import type { Habit } from './habits'

const today = '2022-08-15'

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    category: 'General',
    createdAt: new Date(2022, 7, 10, 9).toISOString(),
    days: [],
    unit: '',
    target: null,
    log: {},
    ...overrides,
  }
}

const earned = (habits: Habit[]) => badges(habits, today).filter((badge) => badge.earned).map((badge) => badge.id)
const checked = (...days: string[]) => Object.fromEntries(days.map((day) => [day, 1]))

describe('badges', () => {
  it('earns nothing without habits, and lists all ten', () => {
    expect(badges([], today)).toHaveLength(10)
    expect(earned([])).toEqual([])
  })

  it('earns the habit badges by count', () => {
    expect(earned([habit('a')])).toEqual(['first-habit'])
    expect(earned(['a', 'b', 'c', 'd', 'e'].map((id) => habit(id)))).toEqual(['first-habit', 'five-habits'])
  })

  it('earns check-in badges at 1, 10, 50 and 100, counting bonus days', () => {
    const days = Array.from({ length: 50 }, (_, i) => `2022-06-${String((i % 30) + 1).padStart(2, '0')}`)
    const many = [habit('a', { log: checked(...days.slice(0, 30)) }), habit('b', { log: checked(...days.slice(0, 20)) })]
    expect(earned(many)).toEqual(expect.arrayContaining(['first-check-in', '10-check-ins', '50-check-ins']))
    expect(earned(many)).not.toContain('100-check-ins')
  })

  it('earns streak badges from the longest scheduled run', () => {
    const run = habit('a', { log: checked('2022-08-10', '2022-08-11', '2022-08-12') })
    expect(earned([run])).toContain('3-day-streak')
    expect(earned([run])).not.toContain('7-day-streak')
  })

  it('earns a perfect day only when every habit due that day is done', () => {
    const a = habit('a', { log: checked('2022-08-12') })
    const weekend = habit('b', { days: [0, 6], log: {} })
    // The 12th is a Friday: only "a" is due, and it is done.
    expect(earned([a, weekend])).toContain('perfect-day')
    expect(earned([a, habit('c')])).not.toContain('perfect-day')
  })

  it('counts today as perfect only once everything due is done', () => {
    expect(earned([habit('a', { log: checked(today) }), habit('b')])).not.toContain('perfect-day')
    expect(earned([habit('a', { log: checked(today) }), habit('b', { log: checked(today) })])).toContain('perfect-day')
  })
})
