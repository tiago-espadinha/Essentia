import { ClaimDialog, getSupabase, useAuth } from '@essentia/supabase'
import { Search, formatNumber, useLocale } from '@essentia/ui'
import { t } from './locale'
import { useRecordMotion } from '@essentia/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { AddTask } from './components/AddTask'
import { AppHeader } from './components/AppHeader'
import { Filters } from './components/Filters'
import { Hero } from './components/Hero'
import { TaskItem, type FocusRequest } from './components/TaskItem'
import { UndoNotice } from './components/UndoNotice'
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
} from './domain/tasks'
import { SYNC_FAILED, useTasks } from './hooks/useTasks'

const client = getSupabase()

export default function App() {
  const locale = useLocale()
  useEffect(() => { document.title = `Acta · ${t('Your Tasks')} · Essentia` }, [locale])
  const auth = useAuth(client)
  const {
    tasks, owner, saveFailed, syncState, sync, unclaimed, answer, conflictOf, keepMine, takeTheirs,
    add, toggle, remove, restore, update,
  } = useTasks(client)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<FocusRequest>()
  const [deleted, setDeleted] = useState<{ task: Task; beforeId: string | null } | null>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const motion = useRecordMotion(mainRef)
  const clearFocusRequest = useCallback(() => setFocusRequest(undefined), [])
  // Another account's list (or the signed-out one) starts clean: no open editor, undo or filter.
  const [shownOwner, setShownOwner] = useState(owner)
  if (shownOwner !== owner) {
    setShownOwner(owner)
    setEditingId(null)
    setDeleted(null)
    setFocusRequest(undefined)
    setStatus('all')
    setSelectedCategory(null)
  }

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
  const done = tasks.filter((task) => task.completed).length

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
    motion(() => remove(id))
    setDeleted({ task, beforeId: tasks[tasks.indexOf(task) + 1]?.id ?? null })
    if (neighbour) setFocusRequest({ id: neighbour.id, target: 'check' })
    else addInput.current?.focus()
  }

  function undoDelete() {
    if (!deleted) return
    motion(() => restore(deleted.task, deleted.beforeId))
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
      <AppHeader account={<AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />}
        search={<Search key={owner ?? 'device'} sourceLabel={t('Your Tasks')}
        records={tasks.map((task) => ({ id: task.id, title: task.text, text: task.category }))}
        onSelect={(id) => {
          showAll()
          setEditingId(id)
          setFocusRequest({ id, target: 'editor' })
        }} />} />
      <main className="acta ui-workspace-layout" ref={mainRef}>
        <Hero total={tasks.length} done={done} progress={progressOf(tasks)} />
        <div className="workspace">
          <AddTask inputRef={addInput} onAdd={(value, due) => motion(() => add(value, due))} />
          <UndoNotice deleted={deleted?.task ?? null} onUndo={undoDelete} />
          {syncState === 'failed' && (
            <div className="sync-notice" role="status">
              <span className="sync-notice__text">{t(SYNC_FAILED)}</span>
              <button type="button" className="undo__button" onClick={() => void sync()}>{t("Try again")}</button>
            </div>
          )}

          {saveFailed && (
            <p className="notice" role="alert">
              {t("Couldn’t save on this device. Your changes last until you close the page.")}
            </p>
          )}

          {tasks.length === 0 ? (
            <section className="empty" aria-labelledby="empty-title">
              <h2 id="empty-title" className="empty__title">
                {t("Nothing on the list.")}
              </h2>
              <p className="empty__text">{t("Write the first thing you want to get done in the field above.")}</p>
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
                    {t(STATUS_LABELS[status])}
                    {category && ` · ${category}`}
                  </h2>
                  <span className="section-row__rule" />
                  <span className="label">{formatNumber(visible.length)}</span>
                </div>
                {visible.length === 0 ? (
                  <div className="empty empty--filtered">
                    <h3 className="empty__title">{t("Nothing matches.")}</h3>
                    <p className="empty__text">{t("No tasks fit this filter.")}</p>
                    <button type="button" className="button-ghost" onClick={showAll}>
                      {t("Show all tasks")}
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
                        conflict={conflictOf(task.id)}
                        onResolve={(id, mine) => (mine ? keepMine(id) : takeTheirs(id))}
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

        </div>
      </main>
      {unclaimed > 0 && auth.status === 'signed-in' && (
        <ClaimDialog count={unclaimed} noun={[t('task'), t('tasks')]} email={auth.email} decline="keep" onAnswer={answer} />
      )}
    </>
  )
}
