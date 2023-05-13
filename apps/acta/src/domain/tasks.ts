import { currentLocale } from '@essentia/ui'
// The task model and the pure rules around it. Dates are ISO calendar days
// ('YYYY-MM-DD'), so comparing them as strings orders them correctly.

export interface Task {
  id: string
  text: string
  completed: boolean
  category: string
  /** ISO day ('YYYY-MM-DD'), or '' when the task has no due date. */
  due: string
  priority: Priority
}

/** How much a task matters, lowest first; 'none' is the default and shows no label. */
export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'None', low: 'Low', medium: 'Medium', high: 'High',
}

export const isPriority = (value: unknown): value is Priority => PRIORITIES.includes(value as Priority)

export type StatusFilter = 'all' | 'active' | 'done'

export const STATUS_LABELS: Record<StatusFilter, string> = { all: 'All', active: 'Active', done: 'Done' }

export interface TaskDraft {
  text: string
  category: string
  due: string
  priority: Priority
}

export const DEFAULT_CATEGORY = 'General'

/** The longest text and category an account accepts (supabase/migration.sql), counted as the inputs count. */
export const LIMITS = { text: 500, category: 100 }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/**
 * A random id. `crypto.randomUUID` exists only in secure contexts (https or
 * localhost), so plain-http LAN testing falls back to `getRandomValues`, still
 * shaped as a version 4 uuid so the account accepts it.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** A new open task; a due that is not an ISO day leaves it undated, an unknown priority leaves it at none. */
export function createTask(text: string, id: string = newId(), due = '', priority = 'none'): Task {
  return {
    id,
    text: text.trim(),
    completed: false,
    category: DEFAULT_CATEGORY,
    due: isIsoDay(due) ? due : '',
    priority: isPriority(priority) ? priority : 'none',
  }
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
    priority: isPriority(draft.priority) ? draft.priority : 'none',
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
  return new Date(`${due}T00:00:00Z`).toLocaleDateString(currentLocale(), {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
