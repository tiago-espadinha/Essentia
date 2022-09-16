import { useEffect, useRef, useState } from 'react'
import { AddHabit } from './AddHabit'
import { AppHeader } from './AppHeader'
import { EditDialog } from './EditDialog'
import { HabitRow } from './HabitRow'
import { HabitSection } from './HabitSection'
import { Hero } from './Hero'
import { categoriesOf, controlId, groupForToday, queryHabits, todayKey, type Habit } from './habits'
import { UndoNotice } from './UndoNotice'
import { useHabits } from './useHabits'

export default function App() {
  const { habits, saveFailed, add, update, toggle, log, remove, restore } = useHabits()
  const [editing, setEditing] = useState<Habit | null>(null)
  const [deleted, setDeleted] = useState<{ habit: Habit; beforeId: string | null } | null>(null)
  // The control to focus once the list has re-rendered: rows remount when they
  // change section, and a delete or an undo moves focus to another row.
  const focusNext = useRef<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusNext.current === null) return
    document.getElementById(focusNext.current)?.focus()
    focusNext.current = null
  })

  const setFocusId = (id: string) => {
    focusNext.current = id
  }

  const today = todayKey()
  const categories = categoriesOf(habits)
  const groups = groupForToday(queryHabits(habits, { search: '', category: null, sort: 'newest' }, today), today)
  const shown = [...groups.due, ...groups.done, ...groups.notDue]

  // Focus moves to the next row (or the previous one at the end), else to the add field.
  function deleteHabit(id: string) {
    const position = shown.findIndex((habit) => habit.id === id)
    const neighbour = shown[position + 1] ?? shown[position - 1]
    const habit = shown[position]
    remove(id)
    setDeleted({ habit, beforeId: habits[habits.indexOf(habit) + 1]?.id ?? null })
    if (neighbour) setFocusId(controlId(neighbour))
    else addInput.current?.focus()
  }

  function undoDelete() {
    if (!deleted) return
    restore(deleted.habit, deleted.beforeId)
    setDeleted(null)
    setFocusId(controlId(deleted.habit))
  }

  const row = (habit: Habit) => (
    <HabitRow
      key={habit.id}
      habit={habit}
      today={today}
      onToggle={(id) => {
        toggle(id, today)
        setFocusId(controlId(habit))
      }}
      onLog={(id, value) => {
        log(id, today, value)
        setFocusId(controlId(habit))
      }}
      onEdit={setEditing}
      onDelete={deleteHabit}
    />
  )

  return (
    <>
      <AppHeader />
      <main className="virtus">
        <Hero habits={habits} today={today} />
        <AddHabit inputRef={addInput} categories={categories} onAdd={add} />
        <UndoNotice deleted={deleted?.habit ?? null} onUndo={undoDelete} />

        {saveFailed && (
          <p className="notice" role="alert">
            Couldn’t save on this device. Your changes last until you close the page.
          </p>
        )}

        {habits.length === 0 ? (
          <section className="empty" aria-labelledby="empty-title">
            <h2 id="empty-title" className="empty__title">
              No habits yet.
            </h2>
            <p className="empty__text">Add one above, then check it in each day to build a streak.</p>
          </section>
        ) : (
          <>
            <HabitSection id="section-due" title="To do" count={groups.due.length}>
              {groups.due.map(row)}
            </HabitSection>
            <HabitSection id="section-done" title="Done today" count={groups.done.length}>
              {groups.done.map(row)}
            </HabitSection>
            <HabitSection id="section-not-due" title="Not due today" count={groups.notDue.length}>
              {groups.notDue.map(row)}
            </HabitSection>
          </>
        )}
      </main>

      {editing && (
        <EditDialog
          habit={editing}
          categories={categories}
          onSave={(draft) => {
            update(editing.id, draft)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
