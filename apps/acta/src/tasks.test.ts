import { describe, expect, it } from 'vitest'
import {
  applyDraft,
  categoriesOf,
  createTask,
  DEFAULT_CATEGORY,
  filterTasks,
  formatDue,
  isIsoDay,
  isOverdue,
  progressOf,
  todayIso,
  type Task,
} from './tasks'

function task(overrides: Partial<Task>): Task {
  return { id: 'x', text: 'Task', completed: false, category: DEFAULT_CATEGORY, due: '', ...overrides }
}

describe('createTask', () => {
  it('trims the text and starts open, in the default category, with no due date', () => {
    expect(createTask('  Write tests  ', 'a')).toEqual({
      id: 'a',
      text: 'Write tests',
      completed: false,
      category: DEFAULT_CATEGORY,
      due: '',
    })
  })

  it('gives each task its own id', () => {
    expect(createTask('One').id).not.toBe(createTask('Two').id)
  })
})

describe('applyDraft', () => {
  const original = task({ id: 'a', completed: true })

  it('saves trimmed text, category and due date, keeping id and completion', () => {
    expect(applyDraft(original, { text: ' New ', category: ' Design ', due: '2022-05-28' })).toEqual({
      id: 'a',
      text: 'New',
      completed: true,
      category: 'Design',
      due: '2022-05-28',
    })
  })

  it('refuses a draft with no text', () => {
    expect(applyDraft(original, { text: '   ', category: 'Design', due: '' })).toBeNull()
  })

  it('falls back to the default category and drops an invalid date', () => {
    expect(applyDraft(original, { text: 'New', category: ' ', due: 'May 28' })).toMatchObject({
      category: DEFAULT_CATEGORY,
      due: '',
    })
  })
})

describe('filterTasks', () => {
  const tasks = [
    task({ id: '1', category: 'Work' }),
    task({ id: '2', category: 'Home', completed: true }),
    task({ id: '3', category: 'Work', completed: true }),
  ]
  const ids = (list: Task[]) => list.map((t) => t.id)

  it('filters by status', () => {
    expect(ids(filterTasks(tasks, 'all', null))).toEqual(['1', '2', '3'])
    expect(ids(filterTasks(tasks, 'active', null))).toEqual(['1'])
    expect(ids(filterTasks(tasks, 'done', null))).toEqual(['2', '3'])
  })

  it('combines status with a category', () => {
    expect(ids(filterTasks(tasks, 'all', 'Work'))).toEqual(['1', '3'])
    expect(ids(filterTasks(tasks, 'done', 'Work'))).toEqual(['3'])
    expect(filterTasks(tasks, 'active', 'Home')).toEqual([])
  })
})

describe('categoriesOf', () => {
  it('lists each category once, sorted', () => {
    const tasks = [task({ category: 'Work' }), task({ category: 'Home' }), task({ category: 'Work' })]
    expect(categoriesOf(tasks)).toEqual(['Home', 'Work'])
  })
})

describe('progressOf', () => {
  it('is 0 for no tasks and a rounded percentage otherwise', () => {
    expect(progressOf([])).toBe(0)
    expect(progressOf([task({ completed: true }), task({}), task({})])).toBe(33)
  })
})

describe('dates', () => {
  it('accepts only real ISO days', () => {
    expect(isIsoDay('2022-05-28')).toBe(true)
    expect(isIsoDay('2022-02-30')).toBe(false)
    expect(isIsoDay('May 28')).toBe(false)
    expect(isIsoDay('')).toBe(false)
  })

  it('reads today in local time', () => {
    expect(todayIso(new Date(2022, 4, 3, 23, 30))).toBe('2022-05-03')
  })

  it('marks only open tasks with a past due date as overdue', () => {
    const today = '2022-05-10'
    expect(isOverdue(task({ due: '2022-05-09' }), today)).toBe(true)
    expect(isOverdue(task({ due: '2022-05-10' }), today)).toBe(false)
    expect(isOverdue(task({ due: '2022-05-09', completed: true }), today)).toBe(false)
    expect(isOverdue(task({ due: '' }), today)).toBe(false)
  })

  it('formats a due date as a calendar day', () => {
    expect(formatDue('2022-05-28')).toBe('May 28')
    expect(formatDue('2023-01-01')).toBe('Jan 1')
  })
})
