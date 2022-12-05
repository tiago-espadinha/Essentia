import { useState, type FormEvent, type RefObject } from 'react'
import { parseQuickAdd, QUICK_ADD_HINT } from './quickAdd'
import { todayKey, type TransactionFields } from './transactions'

interface QuickAddProps {
  inputRef: RefObject<HTMLInputElement | null>
  onAdd: (fields: TransactionFields) => void
}

/** One line in, one transaction out, dated today; details can be changed afterwards with Edit. */
export function QuickAdd({ inputRef, onAdd }: QuickAddProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  // Counts refused submits; each one remounts the alert so it is announced again.
  const [refusals, setRefusals] = useState(0)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseQuickAdd(input)
    if (parsed) {
      onAdd({ ...parsed, date: todayKey() })
      setInput('')
      setError(false)
    } else {
      setError(true)
      setRefusals(refusals + 1)
    }
    inputRef.current?.focus()
  }

  return (
    <form className="add" onSubmit={submit} noValidate>
      <label className="visually-hidden" htmlFor="add-transaction">
        New transaction
      </label>
      <div className="add__row">
        <input
          ref={inputRef}
          id="add-transaction"
          className="input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setError(false)
          }}
          placeholder="Coffee €3.50, or +Salary €2100"
          autoComplete="off"
          aria-invalid={error}
          aria-describedby="add-transaction-hint"
        />
        <button type="submit" className="button-primary add__button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">Add transaction</span>
        </button>
      </div>
      {error ? (
        <p key={refusals} id="add-transaction-hint" className="field-error" role="alert">
          {QUICK_ADD_HINT}
        </p>
      ) : (
        <p id="add-transaction-hint" className="add__hint">
          A leading + records income. End with a category, like “housing”, to file it.
        </p>
      )}
    </form>
  )
}
