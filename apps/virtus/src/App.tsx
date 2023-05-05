import { t } from './locale'
import { Search, useLocale, useRecordMotion } from '@essentia/ui'
import { ClaimDialog, getSupabase, useAuth } from '@essentia/supabase'
import { useEffect, useRef, useState } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { AddHabit } from './components/AddHabit'
import { AppHeader } from './components/AppHeader'
import { EditDialog } from './components/EditDialog'
import { Filters } from './components/Filters'
import { HabitRow } from './components/HabitRow'
import { HabitSection } from './components/HabitSection'
import { HabitStatsDialog } from './components/HabitStatsDialog'
import { LogDialog } from './components/LogDialog'
import { Hero } from './components/Hero'
import { categoriesOf, controlId, isNumeric, queryHabits, todayKey, type Habit, type ListQuery } from './domain/habits'
import { UndoNotice } from './components/UndoNotice'
import { SYNC_FAILED, useHabits } from './hooks/useHabits'
import { StatsView } from './components/StatsView'
import { sectionsFor, type View } from './domain/views'
import { Views } from './components/Views'
import { WeekView } from './components/WeekView'

const NO_FILTER: ListQuery = { search: '', category: null, sort: 'newest' }

// Null without a configured project: no sign-in, and habits stay on this device.
const client = getSupabase()

export default function App() {
  const locale = useLocale()
  useEffect(() => { document.title = `Virtus · ${t('Your Habits')} · Essentia` }, [locale])
  const auth = useAuth(client)
  const { habits, unclaimed, answer, saveFailed, syncState, sync, add, update, toggle, log, remove, restore } = useHabits(client)
  const [editing, setEditing] = useState<Habit | null>(null)
  // By id, so the dialog shows the habit as it is now, after a sync or an edit.
  const [statsHabitId, setStatsHabitId] = useState<string | null>(null)
  const statsFor = habits.find((habit) => habit.id === statsHabitId)
  // A habit removed while its stats are open (by a sync or a sign-out elsewhere) closes them for good.
  if (statsHabitId !== null && !statsFor) setStatsHabitId(null)
  // The amount log dialog is held the same way, and also closes if a synced edit makes the habit yes/no.
  const [logHabitId, setLogHabitId] = useState<string | null>(null)
  const logFor = habits.find((habit) => habit.id === logHabitId && isNumeric(habit))
  if (logHabitId !== null && !logFor) setLogHabitId(null)
  const [view, setView] = useState<View>('today')
  const [query, setQuery] = useState(NO_FILTER)
  const [deleted, setDeleted] = useState<{ habit: Habit; beforeId: string | null } | null>(null)
  // The control to focus once the list has re-rendered: rows remount when they
  // change section, and a delete or an undo moves focus to another row.
  const focusNext = useRef<string | null>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const motion = useRecordMotion(mainRef)

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
  const sections = view === 'week' || view === 'stats' ? [] : sectionsFor(view, habits, query, today)
  const shown = sections.flatMap((section) => section.habits)

  // Focus moves to the next row (or the previous one at the end), else to the
  // add field, or the search field in a view without one.
  function deleteHabit(id: string) {
    const position = shown.findIndex((habit) => habit.id === id)
    const neighbour = shown[position + 1] ?? shown[position - 1]
    const habit = shown[position]
    motion(() => remove(id))
    setDeleted({ habit, beforeId: habits[habits.indexOf(habit) + 1]?.id ?? null })
    if (neighbour) setFocusId(controlId(neighbour))
    else fallbackFocus()
  }

  const fallbackFocus = () => setFocusId(view === 'today' ? 'add-habit' : 'search')

  function undoDelete() {
    if (!deleted) return
    motion(() => restore(deleted.habit, deleted.beforeId))
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
      onOpenLog={(habit) => setLogHabitId(habit.id)}
      showLongest={view === 'streaks'}
      onShowStats={(habit) => setStatsHabitId(habit.id)}
      onEdit={setEditing}
      onDelete={deleteHabit}
    />
  )

  function list() {
    if (view === 'stats') return <StatsView habits={habits} today={today} />
    if (habits.length === 0) {
      return (
        <section className="empty" aria-labelledby="empty-title">
          <h2 id="empty-title" className="empty__title">{t("No habits yet.")}</h2>
          <p className="empty__text">
            {view === 'today' ? t('Add one above, then check it in each day to build a streak.') : t('Add one in Today to start a streak.')}
          </p>
        </section>
      )
    }
    if (view === 'week') {
      return (
        <WeekView
          habits={queryHabits(habits, NO_FILTER, today)}
          today={today}
          onToggle={(id) => toggle(id, today)}
          onShowStats={(habit) => setStatsHabitId(habit.id)}
        />
      )
    }
    return (
      <>
        <Filters query={query} categories={categories} sortable={view === 'today'} onChange={setQuery} />
        {shown.length === 0 ? (
          <section className="empty empty--filtered" aria-labelledby="empty-title">
            <h2 id="empty-title" className="empty__title">{t("No habits match.")}</h2>
            <button type="button" className="button-ghost" onClick={() => setQuery({ ...NO_FILTER, sort: query.sort })}>{t("Clear search and category")}</button>
          </section>
        ) : (
          sections.map((section) => (
            <HabitSection key={section.id} id={section.id} title={t(section.title)} count={section.habits.length}>
              {section.habits.map(row)}
            </HabitSection>
          ))
        )}
      </>
    )
  }

  const searchSession = auth.status === 'signed-in' ? auth.userId : auth.status

  return (
    <>
      <AppHeader search={<Search key={searchSession} sessionKey={searchSession}
        sourceLabel={t('Your Habits')}
        sourceState={auth.status === 'loading' ? 'loading' : syncState === 'failed' && habits.length === 0 ? 'unavailable' : 'ready'}
        records={habits.map((habit) => ({ id: habit.id, title: habit.name, text: habit.category }))}
        onSelect={(id) => {
          setQuery(NO_FILTER)
          setView('today')
          const habit = habits.find((item) => item.id === id)
          if (habit) setFocusId(controlId(habit))
        }} />} account={<AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />} />
      <main className="virtus ui-workspace-layout" ref={mainRef}>
        <Hero habits={habits} today={today} />
        <div className="workspace">
          <Views view={view} onChange={setView} />
          {view === 'today' && <AddHabit inputRef={addInput} categories={categories} onAdd={(value) => motion(() => add(value))} />}
          <UndoNotice deleted={deleted?.habit ?? null} onUndo={undoDelete} />

          {syncState === 'failed' && (
            <div className="sync-notice" role="status">
              <span className="sync-notice__text">{t(SYNC_FAILED)}</span>
              <button type="button" className="undo__button" onClick={() => void sync()}>{t("Try again")}</button>
            </div>
          )}

          {saveFailed && (
            <p className="notice" role="alert">{t("Couldn’t save on this device. Your changes last until you close the page.")}</p>
          )}

          {list()}
        </div>
      </main>

      {unclaimed > 0 && auth.status === 'signed-in' && (
        <ClaimDialog count={unclaimed} noun={[t('habit'), t('habits')]} email={auth.email} onAnswer={answer} />
      )}

      {statsFor && <HabitStatsDialog habit={statsFor} today={today} onClose={() => setStatsHabitId(null)} />}
      {logFor && (
        <LogDialog
          habit={logFor}
          today={today}
          onLog={(value) => {
            log(logFor.id, today, value)
            // Backstop: reaching or leaving the target moves the row to another section, remounting it.
            setFocusId(controlId(logFor))
          }}
          onClose={() => setLogHabitId(null)}
        />
      )}

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
