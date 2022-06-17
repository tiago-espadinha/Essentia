import { useEffect, useRef } from 'react'
import { TaskEditor } from './TaskEditor'
import { formatDue, isOverdue, type Task, type TaskDraft } from './tasks'

/** Asks a row to focus one of its controls; a new object asks again. */
export interface FocusRequest {
  id: string
  target: 'check' | 'edit'
}

interface TaskItemProps {
  task: Task
  today: string
  categories: string[]
  editing: boolean
  focusRequest?: FocusRequest
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
    ;(focusRequest.target === 'check' ? checkRef : editRef).current?.focus()
    onFocused()
  }, [focusRequest, onFocused])

  if (editing) {
    return (
      <li className="task task--editing">
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
    <li className="task">
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
          {task.due && (
            <span className={`label${overdue ? ' task__due--over' : ''}`}>
              {overdue ? 'Overdue · ' : 'Due '}
              <time dateTime={task.due}>{formatDue(task.due)}</time>
            </span>
          )}
        </p>
        <div className="task__actions">
          <button ref={editRef} type="button" className="task__action" onClick={() => onEdit(task.id)}>
            Edit<span className="visually-hidden"> “{task.text}”</span>
          </button>
          <button type="button" className="task__action" onClick={() => onDelete(task.id)}>
            Delete<span className="visually-hidden"> “{task.text}”</span>
          </button>
        </div>
      </div>
    </li>
  )
}
