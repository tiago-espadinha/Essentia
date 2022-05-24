import { formatDue, isOverdue, type Task } from './tasks'

interface TaskItemProps {
  task: Task
  today: string
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export function TaskItem({ task, today, onToggle, onDelete }: TaskItemProps) {
  const textId = `task-${task.id}`
  const overdue = isOverdue(task, today)

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
        <button type="button" className="task__action" onClick={() => onDelete(task.id)}>
          Delete<span className="visually-hidden"> “{task.text}”</span>
        </button>
      </div>
    </li>
  )
}
