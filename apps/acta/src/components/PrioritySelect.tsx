import { t } from '../locale'
import { isPriority, PRIORITIES, PRIORITY_LABELS, type Priority } from '../domain/tasks'

interface PrioritySelectProps {
  id: string
  className: string
  value: Priority
  onChange: (value: Priority) => void
}

/** The four levels as a native select; its label is the caller's, so it can sit inline or as a field. */
export function PrioritySelect({ id, className, value, onChange }: PrioritySelectProps) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(event) => {
        if (isPriority(event.target.value)) onChange(event.target.value)
      }}
    >
      {PRIORITIES.map((level) => (
        <option key={level} value={level}>
          {t(PRIORITY_LABELS[level])}
        </option>
      ))}
    </select>
  )
}
