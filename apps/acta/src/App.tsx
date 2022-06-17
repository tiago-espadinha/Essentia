import { useCallback, useRef, useState } from 'react'
import { AddTask } from './AddTask'
import { AppHeader } from './AppHeader'
import { Filters } from './Filters'
import { Hero } from './Hero'
import { TaskItem, type FocusRequest } from './TaskItem'
import { UndoNotice } from './UndoNotice'
import {
  applyDraft,
  categoriesOf,
  filterTasks,
  progressOf,
  STATUS_LABELS,
  todayIso,
  type StatusFilter,
  type Task,
  type TaskDraft,
} from './tasks'
import { useTasks } from './useTasks'

export default function App() {
  const { tasks, saveFailed, add, toggle, remove, restore, update } = useTasks()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<FocusRequest>()
  const [deleted, setDeleted] = useState<{ task: Task; beforeId: string | null } | null>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const clearFocusRequest = useCallback(() => setFocusRequest(undefined), [])

  const today = todayIso()
  const categories = categoriesOf(tasks)
  // A category filter lapses once its chip is gone: its last task was removed or
  // recategorized, or only one category is left and the chips are hidden.
  const category =
    categories.length > 1 && selectedCategory !== null && categories.includes(selectedCategory)
      ? selectedCategory
      : null
  if (category === null && selectedCategory !== null) setSelectedCategory(null)
  const visible = filterTasks(tasks, status, category)
  const remaining = tasks.filter((task) => !task.completed).length

  // Closing the editor hands focus back to the row's Edit button, or to the add
  // field when the saved task no longer fits the filter.
  function closeEditor(edited?: Task) {
    if (editingId === null) return
    if (!edited || filterTasks([edited], status, category).length > 0) {
      setFocusRequest({ id: editingId, target: 'edit' })
    } else {
      addInput.current?.focus()
    }
    setEditingId(null)
  }

  function save(id: string, draft: TaskDraft) {
    const task = tasks.find((candidate) => candidate.id === id)!
    update(id, draft)
    closeEditor(applyDraft(task, draft) ?? task)
  }

  // Focus moves to the next row (or the previous one at the end), else to the add field.
  function deleteTask(id: string) {
    const position = visible.findIndex((task) => task.id === id)
    const neighbour = visible[position + 1] ?? visible[position - 1]
    const task = visible[position]
    remove(id)
    setDeleted({ task, beforeId: tasks[tasks.indexOf(task) + 1]?.id ?? null })
    if (neighbour) setFocusRequest({ id: neighbour.id, target: 'check' })
    else addInput.current?.focus()
  }

  function undoDelete() {
    if (!deleted) return
    restore(deleted.task, deleted.beforeId)
    setDeleted(null)
    const shown = filterTasks([deleted.task], status, category).length > 0
    if (shown) setFocusRequest({ id: deleted.task.id, target: 'check' })
    else addInput.current?.focus()
  }

  function showAll() {
    setStatus('all')
    setSelectedCategory(null)
  }

  return (
    <>
      <AppHeader />
      <main className="acta">
        <Hero total={tasks.length} remaining={remaining} progress={progressOf(tasks)} />
        <AddTask inputRef={addInput} onAdd={add} />
        <UndoNotice deleted={deleted?.task ?? null} onUndo={undoDelete} />

        {saveFailed && (
          <p className="notice" role="alert">
            Couldn’t save on this device. Your changes last until you close the page.
          </p>
        )}

        {tasks.length === 0 ? (
          <section className="empty" aria-labelledby="empty-title">
            <h2 id="empty-title" className="empty__title">
              Nothing on the list.
            </h2>
            <p className="empty__text">Add the first thing you want to get done.</p>
            <button type="button" className="button-primary" onClick={() => addInput.current?.focus()}>
              Add a task
            </button>
          </section>
        ) : (
          <>
            <Filters
              status={status}
              category={category}
              categories={categories}
              onStatusChange={setStatus}
              onCategoryChange={setSelectedCategory}
            />
            <section aria-labelledby="list-title">
              <div className="section-row">
                <h2 id="list-title" className="label">
                  {STATUS_LABELS[status]}
                  {category && ` · ${category}`}
                </h2>
                <span className="section-row__rule" />
                <span className="label">{visible.length}</span>
              </div>
              {visible.length === 0 ? (
                <div className="empty empty--filtered">
                  <h3 className="empty__title">Nothing matches.</h3>
                  <p className="empty__text">No tasks fit this filter.</p>
                  <button type="button" className="button-ghost" onClick={showAll}>
                    Show all tasks
                  </button>
                </div>
              ) : (
                <ul className="tasks">
                  {visible.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      today={today}
                      categories={categories}
                      editing={task.id === editingId}
                      focusRequest={focusRequest?.id === task.id ? focusRequest : undefined}
                      onToggle={toggle}
                      onDelete={deleteTask}
                      onFocused={clearFocusRequest}
                      onEdit={setEditingId}
                      onCloseEditor={closeEditor}
                      onSave={save}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tasks.length > 0 && (
          <footer className="summary label">
            <span>
              <strong>{tasks.length - remaining}</strong> completed
            </span>
            <span>
              <strong>{remaining}</strong> left to do
            </span>
          </footer>
        )}
      </main>
    </>
  )
}
