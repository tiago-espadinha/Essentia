import { t } from '../locale'
import type { RefObject } from 'react'

interface DueDateFieldProps {
  id: string
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  /**
   * Set after a save was refused because the field holds a partial date. A
   * partly typed date leaves the value empty; only `validity.badInput` tells
   * it apart from no date, so forms check that before saving.
   */
  invalid: boolean
  onChange: (value: string) => void
}

export function DueDateField({ id, inputRef, value, invalid, onChange }: DueDateFieldProps) {
  const errorId = `${id}-error`

  function clear() {
    // Resetting the element clears a partial entry, which React's '' cannot.
    if (inputRef.current) inputRef.current.value = ''
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {t('Due date')}
      </label>
      <div className="due-field__row">
        <input
          ref={inputRef}
          id={id}
          className="input due-field__input"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        />
        {(value || invalid) && (
          <button type="button" className="button-ghost due-field__clear" onClick={clear}>
            {t('Clear date')}
          </button>
        )}
      </div>
      {invalid && (
        <p id={errorId} className="field-error" role="alert">
          {t('Enter a full date, or clear it.')}
        </p>
      )}
    </div>
  )
}
