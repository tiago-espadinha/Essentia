import { describe, expect, it } from 'vitest'
import type { Habit } from './habits'
import { merge, NO_STAMPS, readRemote, stampChanges, type CheckInRow, type HabitRow, type Push, type Remote, type Stamps } from './sync'

const ID = '0b5c1f6e-4b7a-4c1d-9e2f-1a2b3c4d5e6f'
const OTHER = '7d9e8f00-1111-4222-8333-444455556666'
const T0 = '2022-09-19T08:00:00.000Z'
const T1 = '2022-09-20T08:00:00.000Z'
const T2 = '2022-09-21T08:00:00.000Z'
const NOW = '2022-09-22T08:00:00.000Z'

function habit(overrides: Partial<Habit> = {}): Habit {
  return { id: ID, name: 'Read', category: 'General', createdAt: T0, days: [], unit: '', target: null, log: {}, ...overrides }
}

function row(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: ID,
    name: 'Read',
    category: 'General',
    days: [],
    unit: '',
    target: null,
    created_at: '2022-09-19T08:00:00+00:00',
    updated_at: T0,
    deleted_at: null,
    ...overrides,
  }
}

const checkIn = (day: string, value: number, at: string, habitId = ID): CheckInRow => ({
  habit_id: habitId,
  day,
  value,
  updated_at: at,
})

const remote = (habits: HabitRow[] = [], checkIns: CheckInRow[] = []): Remote => ({ habits, checkIns })
const stamps = (overrides: Partial<Stamps>): Stamps => ({ ...NO_STAMPS, ...overrides })

/** What the server holds after applying a push, to check the next sync has nothing left to send. */
function applied(server: Remote, push: Push): Remote {
  const habits = new Map(server.habits.map((r) => [r.id, r]))
  for (const r of push.habits) habits.set(r.id, r)
  for (const { id, at } of push.deletions) habits.set(id, { ...habits.get(id)!, updated_at: at, deleted_at: at })
  const checkIns = new Map(server.checkIns.map((r) => [`${r.habit_id}/${r.day}`, r]))
  for (const r of push.checkIns) checkIns.set(`${r.habit_id}/${r.day}`, r)
  return remote([...habits.values()], [...checkIns.values()])
}

describe('stampChanges', () => {
  it('stamps an added habit, a settings edit and only the day that was checked in', () => {
    const added = stampChanges([], [habit()], NO_STAMPS, T1)
    expect(added.habits).toEqual({ [ID]: T1 })

    const checked = stampChanges([habit()], [habit({ log: { '2022-09-20': 1 } })], added, T2)
    expect(checked.habits).toEqual({ [ID]: T1 })
    expect(checked.days).toEqual({ [ID]: { '2022-09-20': T2 } })

    const renamed = stampChanges([habit()], [habit({ name: 'Read more' })], checked, NOW)
    expect(renamed.habits).toEqual({ [ID]: NOW })
  })

  it('stamps a deletion, and an undo clears it while keeping the day stamps', () => {
    const before = stamps({ habits: { [ID]: T0 }, days: { [ID]: { '2022-09-20': T1 } } })
    const deleted = stampChanges([habit()], [], before, T2)
    expect(deleted.deleted).toEqual({ [ID]: T2 })
    expect(deleted.habits).toEqual({})

    const restored = stampChanges([], [habit()], deleted, NOW)
    expect(restored.deleted).toEqual({})
    expect(restored.habits).toEqual({ [ID]: NOW })
    expect(restored.days).toEqual({ [ID]: { '2022-09-20': T1 } })
  })
})

describe('merge', () => {
  it('uploads this device’s habits and check-ins on the first sign-in', () => {
    const local = [habit({ log: { '2022-09-20': 1 } })]
    const result = merge(local, NO_STAMPS, remote(), NOW)

    expect(result.habits).toEqual(local)
    expect(result.push.habits).toEqual([expect.objectContaining({ id: ID, name: 'Read', updated_at: T0, deleted_at: null })])
    expect(result.push.checkIns).toEqual([checkIn('2022-09-20', 1, NOW)])
    expect(merge(result.habits, result.stamps, applied(remote(), result.push), NOW).push).toEqual({ habits: [], deletions: [], checkIns: [] })
  })

  it('brings in habits from another device with their check-ins, newest first', () => {
    const server = remote(
      [row({ id: OTHER, name: 'Walk', created_at: T1, updated_at: T1 }), row({ created_at: T2, updated_at: T2 })],
      [checkIn('2022-09-20', 1, T1, OTHER), checkIn('2022-09-21', 0, T2, OTHER)],
    )
    const result = merge([], NO_STAMPS, server, NOW)

    expect(result.habits.map((h) => h.id)).toEqual([ID, OTHER])
    expect(result.habits[1]).toMatchObject({ name: 'Walk', createdAt: T1, log: { '2022-09-20': 1 } })
    expect(result.push).toEqual({ habits: [], deletions: [], checkIns: [] })
  })

  it('keeps the newer settings on either side', () => {
    const local = [habit({ name: 'Read here' })]
    const newerHere = merge(local, stamps({ habits: { [ID]: T2 } }), remote([row({ name: 'Read there', updated_at: T1 })]), NOW)
    expect(newerHere.habits[0].name).toBe('Read here')
    expect(newerHere.push.habits).toEqual([expect.objectContaining({ name: 'Read here', updated_at: T2 })])

    const newerThere = merge(local, stamps({ habits: { [ID]: T1 } }), remote([row({ name: 'Read there', updated_at: T2 })]), NOW)
    expect(newerThere.habits[0].name).toBe('Read there')
    expect(newerThere.push.habits).toEqual([])
    expect(newerThere.stamps.habits[ID]).toBe(T2)
  })

  it('merges check-ins day by day, including a cleared one', () => {
    const local = [habit({ log: { '2022-09-19': 1, '2022-09-21': 1 } })]
    const localStamps = stamps({
      habits: { [ID]: T0 },
      days: { [ID]: { '2022-09-19': T1, '2022-09-20': T2, '2022-09-21': T1 } },
    })
    const server = remote(
      [row()],
      [checkIn('2022-09-19', 1, T0), checkIn('2022-09-20', 1, T1), checkIn('2022-09-21', 0, T2)],
    )
    const result = merge(local, localStamps, server, NOW)

    // 19th: same value, sent again as the newer stamp; 20th: cleared here later;
    // 21st: cleared there later.
    expect(result.habits[0].log).toEqual({ '2022-09-19': 1 })
    expect(result.push.checkIns).toEqual([checkIn('2022-09-19', 1, T1), checkIn('2022-09-20', 0, T2)])
    expect(merge(result.habits, result.stamps, applied(server, result.push), NOW).push.checkIns).toEqual([])
  })

  it('deletes on the server what was deleted here later than it changed there', () => {
    const result = merge([], stamps({ deleted: { [ID]: T2 } }), remote([row({ updated_at: T1 })]), NOW)
    expect(result.habits).toEqual([])
    expect(result.push.deletions).toEqual([{ id: ID, at: T2 }])
  })

  it('brings a habit back when it was edited elsewhere after the delete here', () => {
    const result = merge([], stamps({ deleted: { [ID]: T1 } }), remote([row({ name: 'Read daily', updated_at: T2 })], [checkIn('2022-09-20', 1, T0)]), NOW)
    expect(result.habits).toEqual([expect.objectContaining({ name: 'Read daily', log: { '2022-09-20': 1 } })])
    expect(result.stamps.deleted).toEqual({})
    expect(result.push.deletions).toEqual([])
  })

  it('removes a habit deleted elsewhere after it last changed here', () => {
    const result = merge([habit({ log: { '2022-09-20': 1 } })], stamps({ habits: { [ID]: T1 } }), remote([row({ updated_at: T2, deleted_at: T2 })]), NOW)
    expect(result.habits).toEqual([])
    expect(result.stamps.deleted).toEqual({ [ID]: T2 })
    expect(result.push).toEqual({ habits: [], deletions: [], checkIns: [] })
  })

  it('forgets a deletion the server never saw', () => {
    const result = merge([], stamps({ deleted: { [ID]: T1 } }), remote(), NOW)
    expect(result.stamps.deleted).toEqual({})
    expect(result.push.deletions).toEqual([])
  })

  it('keeps a habit whose id cannot be stored on this device only', () => {
    const local = [habit({ id: 'h1', log: { '2022-09-20': 1 } })]
    const result = merge(local, NO_STAMPS, remote(), NOW)
    expect(result.habits).toEqual(local)
    expect(result.push).toEqual({ habits: [], deletions: [], checkIns: [] })
  })
})

describe('readRemote', () => {
  it('skips rows the app cannot trust', () => {
    const habits = [
      row(),
      row({ id: 'not-a-uuid' }),
      row({ id: OTHER, name: '  ' }),
      { ...row({ id: OTHER }), days: [7] },
      { ...row({ id: OTHER }), target: -1 },
      { ...row({ id: OTHER }), updated_at: 'yesterday' },
      null,
    ]
    const checkIns = [
      checkIn('2022-09-20', 2.5, T1),
      checkIn('2022-09-23', 1, T1),
      checkIn('1999-12-31', 1, T1),
      checkIn('2022-02-30', 1, T1),
      { ...checkIn('2022-09-20', 1, T1), value: -1 },
      { ...checkIn('2022-09-20', 1, T1), value: '1' },
    ]
    const result = readRemote(habits, checkIns, '2000-01-01', '2022-09-22')
    expect(result.habits).toEqual([row()])
    expect(result.checkIns).toEqual([checkIn('2022-09-20', 2.5, T1)])
  })
})
