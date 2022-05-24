import { useRef } from 'react'
import { AddTask } from './AddTask'
import { AppHeader } from './AppHeader'
import { Hero } from './Hero'
import { TaskItem } from './TaskItem'
import { progressOf, todayIso } from './tasks'
import { useTasks } from './useTasks'

export default function App() {
  const { tasks, saveFailed, add, toggle, remove } = useTasks()
  const addInput = useRef<HTMLInputElement>(null)
  const today = todayIso()
  const remaining = tasks.filter((task) => !task.completed).length

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
                <TaskItem key={task.id} task={task} today={today} onToggle={toggle} onDelete={remove} />
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
