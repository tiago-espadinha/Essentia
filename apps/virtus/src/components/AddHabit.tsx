import { t } from '../locale'
import { useState, type FormEvent, type RefObject } from 'react'
import { HashtagChip, HashtagInput, parseHashtag } from '@essentia/ui'
import { HabitFields } from './HabitFields'
import { EMPTY_FORM, readForm, type FormErrors } from '../domain/habitForm'
import type { HabitDraft } from '../domain/habits'
import { LIMITS } from '../data/sync'

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
  // A '#name' word files the habit under that category, over the Category field.
  const parsed = parseHashtag(form.name, LIMITS.category)
  const tagged = parsed.tag === null ? null
    : categories.find((name) => name.toLowerCase() === parsed.tag!.toLowerCase()) ?? parsed.tag

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = readForm({ ...form, name: parsed.text, category: tagged ?? form.category })
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
      <label className="visually-hidden" htmlFor="add-habit">{t("New habit")}</label>
      <div className="add__row">
        <HashtagInput
          inputRef={inputRef}
          id="add-habit"
          className="input add__input"
          value={form.name}
          maxLength={LIMITS.name}
          categories={categories}
          maxTag={LIMITS.category}
          onValueChange={(name) => {
            setForm({ ...form, name })
            setErrors({ ...errors, name: undefined })
          }}
          placeholder={t("Add a new habit…")}
          autoComplete="off"
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name ? 'add-habit-error' : undefined}
        />
        <button type="submit" className="button-primary add__button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">{t("Add habit")}</span>
        </button>
      </div>
      <HashtagChip category={tagged} />
      {errors.name && (
        <p key={refusals} id="add-habit-error" className="field-error" role="alert">
          {t(errors.name)}
        </p>
      )}
      <button
        type="button"
        className="add__options"
        aria-expanded={optionsOpen}
        aria-controls="add-options"
        onClick={() => setOptionsOpen(!optionsOpen)}
      >{t("Options")}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
