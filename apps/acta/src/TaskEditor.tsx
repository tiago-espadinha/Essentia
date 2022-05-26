import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Task, TaskDraft } from './tasks'

interface TaskEditorProps {
  task: Task
  categories: string[]
  onSave: (draft: TaskDraft) => void
  onCancel: () => void
}

export function TaskEditor({ task, categories, onSave, onCancel }: TaskEditorProps) {
  const [draft, setDraft] = useState<TaskDraft>({ text: task.text, category: task.category, due: task.due })
  const [invalid, setInvalid] = useState(false)
  const id = (field: string) => `edit-${task.id}-${field}`

  function submit(event: FormEvent) {
    event.preventDefault()
    if (draft.text.trim()) onSave(draft)
    else setInvalid(true)
  }

  function cancelOnEscape(event: KeyboardEvent) {
    // Escape in the category field closes its suggestions, not the editor.
    const fromSuggestions = event.target instanceof HTMLInputElement && event.target.list !== null
    if (event.key === 'Escape' && !fromSuggestions) onCancel()
  }

  return (
    <form className="editor" onSubmit={submit} onKeyDown={cancelOnEscape} noValidate aria-label="Edit task">
      <div className="field">
        <label className="label" htmlFor={id('text')}>
          Task
        </label>
        <input
          id={id('text')}
          className="input"
          value={draft.text}
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
            A task needs some text.
          </p>
        )}
      </div>
      <div className="editor__row">
        <div className="field">
          <label className="label" htmlFor={id('category')}>
            Category
          </label>
          <input
            id={id('category')}
            className="input"
            value={draft.category}
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
        <div className="field">
          <label className="label" htmlFor={id('due')}>
            Due date
          </label>
          <input
            id={id('due')}
            className="input"
            type="date"
            value={draft.due}
            onChange={(event) => setDraft({ ...draft, due: event.target.value })}
          />
        </div>
      </div>
      <div className="editor__actions">
        <button type="button" className="button-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button-primary">
          Save
        </button>
      </div>
    </form>
  )
}
