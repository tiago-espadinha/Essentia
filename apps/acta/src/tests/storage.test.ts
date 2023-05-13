import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTasks, saveTasks, STORAGE_KEY } from '../data/storage'
import type { Task } from '../domain/tasks'

const valid: Task = { id: 'a', text: 'Write', completed: false, category: 'Work', due: '2022-05-28', priority: 'high' }

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('task storage', () => {
  it('starts empty when nothing is saved', () => {
    expect(loadTasks()).toEqual([])
  })

  it('round-trips the list under the prefixed key', () => {
    expect(saveTasks([valid])).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([valid])
    expect(loadTasks()).toEqual([valid])
  })

  it('loads tasks saved before priorities, or with an unknown level, at none', () => {
    const legacy = { id: 'a', text: 'Write', completed: false, category: 'Work', due: '2022-05-28' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy, { ...valid, id: 'b', priority: 'urgent' }]))
    expect(loadTasks()).toEqual([
      { ...valid, priority: 'none' },
      { ...valid, id: 'b', priority: 'none' },
    ])
  })

  it('ignores corrupt or non-list data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadTasks()).toEqual([])
    localStorage.setItem(STORAGE_KEY, '{"id":"a"}')
    expect(loadTasks()).toEqual([])
  })

  it('skips malformed entries and keeps the valid ones', () => {
    const entries = [valid, null, { ...valid, id: 1 }, { ...valid, text: ' ' }, { ...valid, due: 'May 28' }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    expect(loadTasks()).toEqual([valid])
  })

  it('drops repeated ids and unknown fields, and fills a blank category', () => {
    const entries = [valid, { ...valid, text: 'Copy' }, { ...valid, id: 'b', category: ' ', extra: 1 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    expect(loadTasks()).toEqual([valid, { ...valid, id: 'b', category: 'General' }])
  })

  it('reports a failed save instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(saveTasks([valid])).toBe(false)
  })

  it('treats unreadable storage as empty', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError')
    })
    expect(loadTasks()).toEqual([])
  })
})
