import { useState, type FormEvent, type RefObject } from 'react'

interface AddTaskProps {
  inputRef: RefObject<HTMLInputElement | null>
  onAdd: (text: string) => void
}

export function AddTask({ inputRef, onAdd }: AddTaskProps) {
  const [text, setText] = useState('')
  // Counts refused submits; each one remounts the alert so it is announced again.
  const [refusals, setRefusals] = useState(0)
  const invalid = refusals > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) {
      setRefusals(refusals + 1)
    } else {
      onAdd(text)
      setText('')
      setRefusals(0)
    }
    inputRef.current?.focus()
  }

  return (
    <form className="add" onSubmit={submit} noValidate>
      <label className="visually-hidden" htmlFor="add-task">
        New task
      </label>
      <div className="add__row">
        <input
          ref={inputRef}
          id="add-task"
          className="add__input"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setRefusals(0)
          }}
          placeholder="Add something to do…"
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? 'add-task-error' : undefined}
        />
        <button type="submit" className="button-primary add__button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">Add task</span>
        </button>
      </div>
      {invalid && (
        <p key={refusals} id="add-task-error" className="field-error" role="alert">
          Write something first.
        </p>
      )}
    </form>
  )
}
