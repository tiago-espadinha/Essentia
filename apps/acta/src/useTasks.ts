import { useState } from 'react'
import { loadTasks, saveTasks } from './storage'
import { createTask, type Task } from './tasks'

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
  }
}
