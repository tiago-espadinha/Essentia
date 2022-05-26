import { TaskEditor } from './TaskEditor'
import { formatDue, isOverdue, type Task, type TaskDraft } from './tasks'

interface TaskItemProps {
  task: Task
  today: string
  categories: string[]
  editing: boolean
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string | null) => void
  onSave: (id: string, draft: TaskDraft) => void
}

export function TaskItem({ task, today, categories, editing, onToggle, onDelete, onEdit, onSave }: TaskItemProps) {
  const textId = `task-${task.id}`
  const overdue = isOverdue(task, today)

  if (editing) {
    return (
      <li className="task task--editing">
        <TaskEditor
          task={task}
          categories={categories}
          onSave={(draft) => onSave(task.id, draft)}
          onCancel={() => onEdit(null)}
        />
      </li>
    )
  }

  return (
    <li className="task">
      <input
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
      </div>
      <div className="task__actions">
        <button type="button" className="task__action" onClick={() => onEdit(task.id)}>
          Edit<span className="visually-hidden"> “{task.text}”</span>
        </button>
        <button type="button" className="task__action" onClick={() => onDelete(task.id)}>
          Delete<span className="visually-hidden"> “{task.text}”</span>
        </button>
      </div>
    </li>
  )
}
