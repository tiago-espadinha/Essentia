// The task model and the pure rules around it. Dates are ISO calendar days
// ('YYYY-MM-DD'), so comparing them as strings orders them correctly.

export interface Task {
  id: string
  text: string
  completed: boolean
  category: string
  /** ISO day ('YYYY-MM-DD'), or '' when the task has no due date. */
  due: string
}

export type StatusFilter = 'all' | 'active' | 'done'

export interface TaskDraft {
  text: string
  category: string
  due: string
}

export const DEFAULT_CATEGORY = 'General'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

export function createTask(text: string, id: string = crypto.randomUUID()): Task {
  return { id, text: text.trim(), completed: false, category: DEFAULT_CATEGORY, due: '' }
}

/** Applies an edit; returns null when the draft has no text to save. */
export function applyDraft(task: Task, draft: TaskDraft): Task | null {
  const text = draft.text.trim()
  if (!text) return null
  return {
    ...task,
    text,
    category: draft.category.trim() || DEFAULT_CATEGORY,
    due: isIsoDay(draft.due) ? draft.due : '',
  }
}

export function filterTasks(tasks: Task[], status: StatusFilter, category: string | null): Task[] {
  return tasks.filter((task) => {
    const matchesStatus = status === 'all' || (status === 'done') === task.completed
    return matchesStatus && (category === null || task.category === category)
  })
}

export function categoriesOf(tasks: Task[]): string[] {
  return [...new Set(tasks.map((task) => task.category))].sort((a, b) => a.localeCompare(b))
}

/** Share of tasks completed, as a whole percentage. */
export function progressOf(tasks: Task[]): number {
  if (!tasks.length) return 0
  return Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100)
}

/** Today as an ISO day in the user's own time zone. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isOverdue(task: Task, today: string): boolean {
  return !task.completed && task.due !== '' && task.due < today
}

/** 'May 28' for an ISO day; the date is read as a calendar day, not a moment. */
export function formatDue(due: string): string {
  return new Date(`${due}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
