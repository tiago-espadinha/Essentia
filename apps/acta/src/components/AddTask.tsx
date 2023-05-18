import { t } from '../locale'
import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { HashtagChip, HashtagInput, parseHashtag } from '@essentia/ui'
import { DEFAULT_CATEGORY, formatDue, LIMITS, resolveCategory, type Priority } from '../domain/tasks'
import { DueDateField } from './DueDateField'
import { PrioritySelect } from './PrioritySelect'

interface AddTaskProps {
  inputRef: RefObject<HTMLInputElement | null>
  /** Categories in use, offered as suggestions. */
  categories: string[]
  onAdd: (text: string, due: string, priority: Priority, category: string) => void
}

export function AddTask({ inputRef, categories, onAdd }: AddTaskProps) {
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [dueOpen, setDueOpen] = useState(false)
  const [priority, setPriority] = useState<Priority>('none')
  const [category, setCategory] = useState('')
  const [dueInvalid, setDueInvalid] = useState(false)
  const dueRef = useRef<HTMLInputElement>(null)
  // Counts refused submits; each one remounts the alert so it is announced again.
  const [refusals, setRefusals] = useState(0)
  const invalid = refusals > 0
  // A '#name' word files the task under that category, over the Category field.
  const parsed = parseHashtag(text, LIMITS.category)

  function submit(event: FormEvent) {
    event.preventDefault()
    const dueInput = dueRef.current
    if (!parsed.text.trim()) {
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
    onAdd(parsed.text, due, priority, parsed.tag ?? category)
    setText('')
    setDue('')
    setPriority('none')
    setCategory('')
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
        <HashtagInput
          inputRef={inputRef}
          id="add-task"
          className="add__input"
          value={text}
          maxLength={LIMITS.text}
          categories={categories}
          maxTag={LIMITS.category}
          onValueChange={(value) => {
            setText(value)
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
      <HashtagChip category={parsed.tag === null ? null : resolveCategory(parsed.tag, categories)} />
      {invalid && (
        <p key={refusals} id="add-task-error" className="field-error" role="alert">
          {t("Write something first.")}
        </p>
      )}
      <div className="add__options">
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
        <div className={`add__priority${priority === 'none' ? '' : ' add__priority--set'}`}>
          <label htmlFor="add-priority">{t('Priority')}</label>
          <PrioritySelect id="add-priority" className="add__priority-select" value={priority} onChange={setPriority} />
        </div>
        <div className={`add__category${category.trim() ? ' add__category--set' : ''}`}>
          <label htmlFor="add-category">{t('Category')}</label>
          <input
            id="add-category"
            className="add__category-input"
            value={category}
            maxLength={LIMITS.category}
            placeholder={DEFAULT_CATEGORY}
            list="add-categories"
            autoComplete="off"
            onChange={(event) => setCategory(event.target.value)}
          />
          <datalist id="add-categories">
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>
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
