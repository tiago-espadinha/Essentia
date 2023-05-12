import { t } from '../locale'
import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { formatDue, LIMITS } from '../domain/tasks'
import { DueDateField } from './DueDateField'

interface AddTaskProps {
  inputRef: RefObject<HTMLInputElement | null>
  onAdd: (text: string, due: string) => void
}

export function AddTask({ inputRef, onAdd }: AddTaskProps) {
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [dueOpen, setDueOpen] = useState(false)
  const [dueInvalid, setDueInvalid] = useState(false)
  const dueRef = useRef<HTMLInputElement>(null)
  // Counts refused submits; each one remounts the alert so it is announced again.
  const [refusals, setRefusals] = useState(0)
  const invalid = refusals > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    const dueInput = dueRef.current
    if (!text.trim()) {
      setRefusals(refusals + 1)
      inputRef.current?.focus()
      return
    }
    // The field is unmounted while the toggle is closed, so only an open one can hold a partial date.
    if (dueInput?.validity.badInput) {
      setDueInvalid(true)
      dueInput.focus()
      return
    }
    onAdd(text, due)
    setText('')
    setDue('')
    setDueOpen(false)
    setDueInvalid(false)
    setRefusals(0)
    inputRef.current?.focus()
  }

  return (
    <form className="add" onSubmit={submit} noValidate>
      <label className="visually-hidden" htmlFor="add-task">
        {t("New task")}
      </label>
      <div className="add__row">
        <input
          ref={inputRef}
          id="add-task"
          className="add__input"
          value={text}
          maxLength={LIMITS.text}
          onChange={(event) => {
            setText(event.target.value)
            setRefusals(0)
          }}
          placeholder={t("Add something to do…")}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? 'add-task-error' : undefined}
        />
        <button type="submit" className="button-primary add__button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">{t("Add task")}</span>
        </button>
      </div>
      {invalid && (
        <p key={refusals} id="add-task-error" className="field-error" role="alert">
          {t("Write something first.")}
        </p>
      )}
      <button
        type="button"
        className="add__due-toggle"
        aria-expanded={dueOpen}
        aria-controls={dueOpen ? 'add-due' : undefined}
        onClick={() => {
          // Closing drops any partial entry with the field, so its error goes too.
          setDueOpen(!dueOpen)
          setDueInvalid(false)
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        {due ? (
          <span>
            {t('Due ')}
            <time dateTime={due}>{formatDue(due)}</time>
          </span>
        ) : (
          t('Add due date')
        )}
      </button>
      {dueOpen && (
        <div id="add-due" className="add__due">
          <DueDateField
            id="add-due-date"
            inputRef={dueRef}
            value={due}
            invalid={dueInvalid}
            onChange={(value) => {
              setDue(value)
              setDueInvalid(false)
            }}
          />
        </div>
      )}
    </form>
  )
}
