import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyDraft,
  categoriesOf,
  categoryCounts,
  checkRename,
  createTask,
  DEFAULT_CATEGORY,
  filterTasks,
  formatDue,
  isIsoDay,
  isOverdue,
  moveCategory,
  newId,
  normalizeCategory,
  resolveCategory,
  progressOf,
  todayIso,
  type Task,
} from '../domain/tasks'

function task(overrides: Partial<Task>): Task {
  return { id: 'x', text: 'Task', completed: false, category: DEFAULT_CATEGORY, due: '', priority: 'none', ...overrides }
}

describe('createTask', () => {
  it('trims the text and starts open, in the default category, with no due date or priority', () => {
    expect(createTask('  Write tests  ', 'a')).toEqual({
      id: 'a',
      text: 'Write tests',
      completed: false,
      category: DEFAULT_CATEGORY,
      due: '',
      priority: 'none',
    })
  })

  it('keeps a known priority and drops anything else', () => {
    expect(createTask('Pay rent', 'a', '', 'high').priority).toBe('high')
    expect(createTask('Pay rent', 'a', '', 'urgent').priority).toBe('none')
  })

  it('keeps an ISO due day and drops anything else', () => {
    expect(createTask('Pay rent', 'a', '2023-06-01').due).toBe('2023-06-01')
    expect(createTask('Pay rent', 'a', '2023-02-30').due).toBe('')
    expect(createTask('Pay rent', 'a', '01/06/2023').due).toBe('')
  })

  it('gives each task its own id', () => {
    expect(createTask('One').id).not.toBe(createTask('Two').id)
  })
})

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('still makes unique uuids outside a secure context, where randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const ids = new Set(Array.from({ length: 100 }, newId))
    expect(ids.size).toBe(100)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('applyDraft', () => {
  const original = task({ id: 'a', completed: true })

  it('saves trimmed text, category and due date, keeping id and completion', () => {
    expect(applyDraft(original, { text: ' New ', category: ' Design ', due: '2022-05-28', priority: 'medium' })).toEqual({
      id: 'a',
      text: 'New',
      completed: true,
      category: 'Design',
      due: '2022-05-28',
      priority: 'medium',
    })
  })

  it('refuses a draft with no text', () => {
    expect(applyDraft(original, { text: '   ', category: 'Design', due: '', priority: 'none' })).toBeNull()
  })

  it('clears a priority back to none', () => {
    const ranked = task({ priority: 'high' })
    expect(applyDraft(ranked, { text: 'Task', category: 'General', due: '', priority: 'none' })?.priority).toBe('none')
  })

  it('falls back to the default category, and drops an invalid date and an unknown priority', () => {
    expect(applyDraft(original, { text: 'New', category: ' ', due: '28 May', priority: 'urgent' as Task['priority'] })).toMatchObject({
      category: DEFAULT_CATEGORY,
      due: '',
      priority: 'none',
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
    expect(isIsoDay('28 May')).toBe(false)
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
    expect(formatDue('2022-05-28')).toBe('28 May')
    expect(formatDue('2023-01-01')).toBe('1 Jan')
  })
})

describe('category names', () => {
  it('trims, collapses inner spaces and files a blank or any spelling of General under General', () => {
    expect(normalizeCategory('  Deep \t  work ')).toBe('Deep work')
    expect(normalizeCategory('   ')).toBe(DEFAULT_CATEGORY)
    expect(normalizeCategory(' gEnErAl ')).toBe(DEFAULT_CATEGORY)
  })

  it('reuses a category in use when the typed name matches it ignoring case and spacing', () => {
    expect(resolveCategory(' work ', ['Home', 'Work'])).toBe('Work')
    expect(resolveCategory('saúde', ['Saúde'])).toBe('Saúde')
    expect(resolveCategory('ÉTÉ', ['été'])).toBe('été')
    expect(resolveCategory('Garden', ['Home'])).toBe('Garden')
  })

  it('files a new task under the category given, normalised', () => {
    expect(createTask('Plan', 'a', '', 'none', '  Deep   work ').category).toBe('Deep work')
    expect(createTask('Plan', 'a', '', 'none', ' ').category).toBe(DEFAULT_CATEGORY)
  })

  it('lists stored spellings that differ only in case or spacing as one, spelled by the first task', () => {
    const tasks = [task({ category: 'work' }), task({ category: 'Work' }), task({ category: 'WORK  ' }), task({ category: 'general' })]
    expect(categoriesOf(tasks)).toEqual([DEFAULT_CATEGORY, 'work'])
    expect(categoryCounts(tasks)).toEqual([{ name: DEFAULT_CATEGORY, count: 1 }, { name: 'work', count: 3 }])
  })

  it('filters on a category ignoring case', () => {
    const tasks = [task({ id: '1', category: 'Work' }), task({ id: '2', category: 'WORK' }), task({ id: '3', category: 'Home' })]
    expect(filterTasks(tasks, 'all', 'work').map((t) => t.id)).toEqual(['1', '2'])
  })
})

describe('moveCategory', () => {
  const tasks = [
    task({ id: '1', category: 'work' }),
    task({ id: '2', category: 'Work', completed: true, priority: 'high' }),
    task({ id: '3', category: 'Home' }),
  ]

  it('returns only the moved tasks, each otherwise unchanged', () => {
    expect(moveCategory(tasks, 'Work', 'Office')).toEqual([
      { ...tasks[0], category: 'Office' },
      { ...tasks[1], category: 'Office' },
    ])
  })

  it('unifies the spelling on a case-only rename, skipping tasks already spelled so', () => {
    expect(moveCategory(tasks, 'work', 'Work').map((t) => t.id)).toEqual(['1'])
  })

  it('moves to General when a category is removed', () => {
    expect(moveCategory(tasks, 'Home', DEFAULT_CATEGORY)).toEqual([{ ...tasks[2], category: DEFAULT_CATEGORY }])
  })
})

describe('checkRename', () => {
  const categories = ['General', 'Home', 'Work']

  it('refuses a blank or unchanged name, and General itself', () => {
    expect(checkRename('Work', '  ', categories)).toEqual({ error: 'Name the category.' })
    expect(checkRename('Work', ' Work ', categories)).toEqual({ error: 'That is already its name.' })
    expect(checkRename('General', 'Misc', categories)).toEqual({ error: 'General cannot be renamed.' })
  })

  it('renames, allowing a change of case alone', () => {
    expect(checkRename('Work', 'Office  hours', categories)).toEqual({ name: 'Office hours', merge: null })
    expect(checkRename('Work', 'WORK', categories)).toEqual({ name: 'WORK', merge: null })
  })

  it('merges into another category matching ignoring case, keeping its spelling', () => {
    expect(checkRename('Work', 'home', categories)).toEqual({ name: 'Home', merge: 'Home' })
    expect(checkRename('Work', 'general', categories)).toEqual({ name: 'General', merge: 'General' })
  })
})
