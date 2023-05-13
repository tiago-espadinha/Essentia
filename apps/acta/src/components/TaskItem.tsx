import { t } from '../locale'
import { useEffect, useRef } from 'react'
import { TaskEditor } from './TaskEditor'
import { formatDue, isOverdue, type Priority, type Task, type TaskDraft } from '../domain/tasks'
import type { ConflictKind } from '../data/sync'

const CONFLICT_TEXT: Record<ConflictKind, string> = {
  changed: 'Changed on another device.',
  'deleted-there': 'Deleted on another device.',
  'deleted-here': 'You deleted this, but it changed on another device.',
}

const PRIORITY_TEXT: Record<Exclude<Priority, 'none'>, string> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
}

/** Asks a row to focus one of its controls; a new object asks again. */
export interface FocusRequest {
  id: string
  target: 'check' | 'edit' | 'editor'
}

interface TaskItemProps {
  task: Task
  today: string
  categories: string[]
  editing: boolean
  focusRequest?: FocusRequest
  /** Set while this task waits for Keep mine or Use theirs. */
  conflict?: ConflictKind | null
  onResolve?: (id: string, keepMine: boolean) => void
  onFocused: () => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onCloseEditor: () => void
  onSave: (id: string, draft: TaskDraft) => void
}

export function TaskItem({
  task,
  today,
  categories,
  editing,
  focusRequest,
  conflict = null,
  onResolve = () => {},
  onFocused,
  onToggle,
  onDelete,
  onEdit,
  onCloseEditor,
  onSave,
}: TaskItemProps) {
  const textId = `task-${task.id}`
  const overdue = isOverdue(task, today)
  const checkRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)

  // Each request is used once, so a row scrolled back into view by a filter
  // does not take focus again.
  useEffect(() => {
    if (!focusRequest) return
    if (focusRequest.target === 'editor') document.getElementById(`edit-${task.id}-text`)?.focus()
    else (focusRequest.target === 'check' ? checkRef : editRef).current?.focus()
    onFocused()
  }, [focusRequest, onFocused, task.id])

  if (editing) {
    return (
      <li className="task task--editing" data-motion-item={task.id}>
        <TaskEditor
          task={task}
          categories={categories}
          onSave={(draft) => onSave(task.id, draft)}
          onCancel={onCloseEditor}
        />
      </li>
    )
  }

  return (
    <li className="task" data-motion-item={task.id}>
      <input
        ref={checkRef}
        type="checkbox"
        className="task__check"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        aria-labelledby={textId}
      />
      <div className="task__body">
        <p id={textId} className="task__text">
          {task.text}
        </p>
        <p className="task__meta">
          <span className="label task__tag">{task.category}</span>
          {task.priority !== 'none' && (
            <span className={`label task__priority task__priority--${task.priority}`}>
              {t(PRIORITY_TEXT[task.priority])}
            </span>
          )}
          {task.due && (
            <span className={`label${overdue ? ' task__due--over' : ''}`}>
              {overdue ? t('Overdue · ') : t('Due ')}
              <time dateTime={task.due}>{formatDue(task.due)}</time>
            </span>
          )}
        </p>
        {conflict && (
          <div className="task__conflict" role="group" aria-label={t('Sync conflict')}>
            <p className="task__conflict-text">{t(CONFLICT_TEXT[conflict])}</p>
            <div className="task__conflict-actions">
              <button type="button" className="task__resolve" onClick={() => onResolve(task.id, true)}>
                {t('Keep mine')}<span className="visually-hidden"> “{task.text}”</span>
              </button>
              <button type="button" className="task__resolve" onClick={() => onResolve(task.id, false)}>
                {t('Use theirs')}<span className="visually-hidden"> “{task.text}”</span>
              </button>
            </div>
          </div>
        )}
        <div className="task__actions">
          <button ref={editRef} type="button" className="task__action" onClick={() => onEdit(task.id)}>
            {t('Edit')}<span className="visually-hidden"> “{task.text}”</span>
          </button>
          <button type="button" className="task__action" onClick={() => onDelete(task.id)}>
            {t('Delete')}<span className="visually-hidden"> “{task.text}”</span>
          </button>
        </div>
      </div>
    </li>
  )
}
