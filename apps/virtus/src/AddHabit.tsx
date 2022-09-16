import { useState, type FormEvent, type RefObject } from 'react'
import { HabitFields } from './HabitFields'
import { EMPTY_FORM, readForm, type FormErrors } from './habitForm'
import type { HabitDraft } from './habits'

interface AddHabitProps {
  inputRef: RefObject<HTMLInputElement | null>
  categories: string[]
  onAdd: (draft: HabitDraft) => void
}

export function AddHabit({ inputRef, categories, onAdd }: AddHabitProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  // Counts refused submits; each one remounts the alert so it is announced again.
  const [refusals, setRefusals] = useState(0)

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = readForm(form)
    if (result.errors) {
      setErrors(result.errors)
      setRefusals(refusals + 1)
      // A settings error is only visible with the options open.
      if (!result.errors.name) setOptionsOpen(true)
    } else {
      onAdd(result.draft)
      setForm(EMPTY_FORM)
      setErrors({})
      setOptionsOpen(false)
    }
    inputRef.current?.focus()
  }

  return (
    <form className="add" onSubmit={submit} noValidate>
      <label className="visually-hidden" htmlFor="add-habit">
        New habit
      </label>
      <div className="add__row">
        <input
          ref={inputRef}
          id="add-habit"
          className="input add__input"
          value={form.name}
          onChange={(event) => {
            setForm({ ...form, name: event.target.value })
            setErrors({ ...errors, name: undefined })
          }}
          placeholder="Add a new habit…"
          autoComplete="off"
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name ? 'add-habit-error' : undefined}
        />
        <button type="submit" className="button-primary add__button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">Add habit</span>
        </button>
      </div>
      {errors.name && (
        <p key={refusals} id="add-habit-error" className="field-error" role="alert">
          {errors.name}
        </p>
      )}
      <button
        type="button"
        className="add__options"
        aria-expanded={optionsOpen}
        aria-controls="add-options"
        onClick={() => setOptionsOpen(!optionsOpen)}
      >
        Options
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id="add-options" hidden={!optionsOpen}>
        <HabitFields
          idPrefix="add"
          form={form}
          errors={errors}
          categories={categories}
          onChange={(next) => {
            setForm(next)
            setErrors({ name: errors.name })
          }}
        />
      </div>
    </form>
  )
}
