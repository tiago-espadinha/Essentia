import { useEffect, useRef, useState } from 'react'
import { AddHabit } from './AddHabit'
import { AppHeader } from './AppHeader'
import { EditDialog } from './EditDialog'
import { Filters } from './Filters'
import { HabitRow } from './HabitRow'
import { HabitSection } from './HabitSection'
import { Hero } from './Hero'
import { categoriesOf, controlId, queryHabits, todayKey, type Habit, type ListQuery } from './habits'
import { UndoNotice } from './UndoNotice'
import { useHabits } from './useHabits'
import { sectionsFor, type View } from './views'
import { Views } from './Views'

const NO_FILTER: ListQuery = { search: '', category: null, sort: 'newest' }

export default function App() {
  const { habits, saveFailed, add, update, toggle, log, remove, restore } = useHabits()
  const [editing, setEditing] = useState<Habit | null>(null)
  const [view, setView] = useState<View>('today')
  const [query, setQuery] = useState(NO_FILTER)
  const [deleted, setDeleted] = useState<{ habit: Habit; beforeId: string | null } | null>(null)
  // The control to focus once the list has re-rendered: rows remount when they
  // change section, and a delete or an undo moves focus to another row.
  const focusNext = useRef<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusNext.current === null) return
    // The target may be gone (the last row deleted, an undo in a view with no
    // rows); the current view's tab keeps focus in the page.
    const target = document.getElementById(focusNext.current) ?? document.querySelector<HTMLElement>('.views__button[aria-current]')
    target?.focus()
    focusNext.current = null
  })

  const setFocusId = (id: string) => {
    focusNext.current = id
  }

  const today = todayKey()
  const categories = categoriesOf(habits)
  // A category filter lapses once its chip is gone: its last habit was removed or
  // recategorized, or only one category is left and the chips are hidden.
  const category = categories.length > 1 && query.category !== null && categories.includes(query.category) ? query.category : null
  if (category !== query.category) setQuery({ ...query, category })
  const sections = sectionsFor(view, habits, query, today)
  const shown = sections.flatMap((section) => section.habits)

  // Focus moves to the next row (or the previous one at the end), else to the
  // add field, or the search field in a view without one.
  function deleteHabit(id: string) {
    const position = shown.findIndex((habit) => habit.id === id)
    const neighbour = shown[position + 1] ?? shown[position - 1]
    const habit = shown[position]
    remove(id)
    setDeleted({ habit, beforeId: habits[habits.indexOf(habit) + 1]?.id ?? null })
    if (neighbour) setFocusId(controlId(neighbour))
    else fallbackFocus()
  }

  const fallbackFocus = () => setFocusId(view === 'today' ? 'add-habit' : 'search')

  function undoDelete() {
    if (!deleted) return
    restore(deleted.habit, deleted.beforeId)
    setDeleted(null)
    if (queryHabits([deleted.habit], query, today).length > 0) setFocusId(controlId(deleted.habit))
    else fallbackFocus()
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
      showLongest={view === 'streaks'}
      onEdit={setEditing}
      onDelete={deleteHabit}
    />
  )

  function list() {
    if (habits.length === 0) {
      return (
        <section className="empty" aria-labelledby="empty-title">
          <h2 id="empty-title" className="empty__title">
            No habits yet.
          </h2>
          <p className="empty__text">
            {view === 'today' ? 'Add one above, then check it in each day to build a streak.' : 'Add one in Today to start a streak.'}
          </p>
        </section>
      )
    }
    return (
      <>
        <Filters query={query} categories={categories} sortable={view === 'today'} onChange={setQuery} />
        {shown.length === 0 ? (
          <section className="empty empty--filtered" aria-labelledby="empty-title">
            <h2 id="empty-title" className="empty__title">
              No habits match.
            </h2>
            <button type="button" className="button-ghost" onClick={() => setQuery({ ...NO_FILTER, sort: query.sort })}>
              Clear search and category
            </button>
          </section>
        ) : (
          sections.map((section) => (
            <HabitSection key={section.id} id={section.id} title={section.title} count={section.habits.length}>
              {section.habits.map(row)}
            </HabitSection>
          ))
        )}
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <main className="virtus">
        <Hero habits={habits} today={today} />
        <Views view={view} onChange={setView} />
        {view === 'today' && <AddHabit inputRef={addInput} categories={categories} onAdd={add} />}
        <UndoNotice deleted={deleted?.habit ?? null} onUndo={undoDelete} />

        {saveFailed && (
          <p className="notice" role="alert">
            Couldn’t save on this device. Your changes last until you close the page.
          </p>
        )}

        {list()}
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
