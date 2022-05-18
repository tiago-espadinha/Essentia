import { DEFAULT_CATEGORY, isIsoDay, type Task } from './tasks'

export const STORAGE_KEY = 'essentia-acta-tasks'

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false
  const task = value as Record<string, unknown>
  return (
    typeof task.id === 'string' &&
    typeof task.text === 'string' &&
    task.text.trim() !== '' &&
    typeof task.completed === 'boolean' &&
    typeof task.category === 'string' &&
    typeof task.due === 'string' &&
    (task.due === '' || isIsoDay(task.due))
  )
}

/** Reads the saved list; anything unreadable, malformed or repeated is skipped, not trusted. */
export function loadTasks(): Task[] {
  let saved: unknown
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(saved)) return []

  const seen = new Set<string>()
  return saved.filter(isTask).flatMap(({ id, text, completed, category, due }) => {
    if (seen.has(id)) return []
    seen.add(id)
    return [{ id, text, completed, category: category.trim() || DEFAULT_CATEGORY, due }]
  })
}

/** Returns false when the browser refuses to store the list (private mode, quota). */
export function saveTasks(tasks: Task[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    return true
  } catch {
    return false
  }
}
