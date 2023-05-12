import { t } from '../locale'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LIMITS, type Task, type TaskDraft } from '../domain/tasks'
import { DueDateField } from './DueDateField'

interface TaskEditorProps {
  task: Task
  categories: string[]
  onSave: (draft: TaskDraft) => void
  onCancel: () => void
}

export function TaskEditor({ task, categories, onSave, onCancel }: TaskEditorProps) {
  const [draft, setDraft] = useState<TaskDraft>({ text: task.text, category: task.category, due: task.due })
  const [invalid, setInvalid] = useState(false)
  const [dueInvalid, setDueInvalid] = useState(false)
  const dueRef = useRef<HTMLInputElement>(null)
  const id = (field: string) => `edit-${task.id}-${field}`

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.text.trim()) {
      setInvalid(true)
    } else if (dueRef.current?.validity.badInput) {
      setDueInvalid(true)
      dueRef.current?.focus()
    } else {
      onSave(draft)
    }
  }

  function cancelOnEscape(event: KeyboardEvent) {
    // Escape in the category field closes its suggestions, not the editor.
    const fromSuggestions = event.target instanceof HTMLInputElement && event.target.list !== null
    if (event.key === 'Escape' && !fromSuggestions) onCancel()
  }

  return (
    <form className="editor" onSubmit={submit} onKeyDown={cancelOnEscape} noValidate aria-label={t("Edit task")}>
      <div className="field">
        <label className="label" htmlFor={id('text')}>
          {t("Task")}
        </label>
        <input
          id={id('text')}
          className="input"
          value={draft.text}
          maxLength={LIMITS.text}
          onChange={(event) => {
            setDraft({ ...draft, text: event.target.value })
            setInvalid(false)
          }}
          autoFocus
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? id('error') : undefined}
        />
        {invalid && (
          <p id={id('error')} className="field-error">
            {t("A task needs some text.")}
          </p>
        )}
      </div>
      <div className="editor__row">
        <div className="field">
          <label className="label" htmlFor={id('category')}>
            {t("Category")}
          </label>
          <input
            id={id('category')}
            className="input"
            value={draft.category}
            maxLength={LIMITS.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            list={id('categories')}
            autoComplete="off"
          />
          <datalist id={id('categories')}>
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>
        <DueDateField
          id={id('due')}
          inputRef={dueRef}
          value={draft.due}
          invalid={dueInvalid}
          onChange={(due) => {
            setDraft({ ...draft, due })
            setDueInvalid(false)
          }}
        />
      </div>
      <div className="editor__actions">
        <button type="button" className="button-ghost" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button type="submit" className="button-primary">
          {t("Save")}
        </button>
      </div>
    </form>
  )
}
