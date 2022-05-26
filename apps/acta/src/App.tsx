import { useRef, useState } from 'react'
import { AddTask } from './AddTask'
import { AppHeader } from './AppHeader'
import { Hero } from './Hero'
import { TaskItem } from './TaskItem'
import { categoriesOf, progressOf, todayIso, type TaskDraft } from './tasks'
import { useTasks } from './useTasks'

export default function App() {
  const { tasks, saveFailed, add, toggle, remove, update } = useTasks()
  const [editingId, setEditingId] = useState<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const categories = categoriesOf(tasks)
  const today = todayIso()
  const remaining = tasks.filter((task) => !task.completed).length

  function save(id: string, draft: TaskDraft) {
    update(id, draft)
    setEditingId(null)
  }

  return (
    <>
      <AppHeader />
      <main className="acta">
        <Hero total={tasks.length} remaining={remaining} progress={progressOf(tasks)} />
        <AddTask inputRef={addInput} onAdd={add} />

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
          <section aria-labelledby="list-title">
            <div className="section-row">
              <h2 id="list-title" className="label">
                All
              </h2>
              <span className="section-row__rule" />
              <span className="label">{tasks.length}</span>
            </div>
            <ul className="tasks">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  today={today}
                  categories={categories}
                  editing={task.id === editingId}
                  onToggle={toggle}
                  onDelete={remove}
                  onEdit={setEditingId}
                  onSave={save}
                />
              ))}
            </ul>
          </section>
        )}

        <footer className="summary label">
          <span>
            <strong>{tasks.length - remaining}</strong> completed
          </span>
          <span>
            <strong>{remaining}</strong> left to do
          </span>
        </footer>
      </main>
    </>
  )
}
