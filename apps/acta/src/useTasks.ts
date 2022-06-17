import { useState } from 'react'
import { loadTasks, saveTasks } from './storage'
import { applyDraft, createTask, type Task, type TaskDraft } from './tasks'

/** The task list, saved to this device on every change. */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [saveFailed, setSaveFailed] = useState(false)

  function commit(next: Task[]) {
    setTasks(next)
    setSaveFailed(!saveTasks(next))
  }

  return {
    tasks,
    saveFailed,
    add: (text: string) => commit([createTask(text), ...tasks]),
    toggle: (id: string) =>
      commit(tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task))),
    remove: (id: string) => commit(tasks.filter((task) => task.id !== id)),
    /** Puts a deleted task back before the task that followed it, or at the end. */
    restore: (task: Task, beforeId: string | null) => {
      const index = tasks.findIndex((candidate) => candidate.id === beforeId)
      commit(tasks.toSpliced(index === -1 ? tasks.length : index, 0, task))
    },
    update: (id: string, draft: TaskDraft) =>
      commit(tasks.map((task) => (task.id === id ? (applyDraft(task, draft) ?? task) : task))),
  }
}
