import { t } from '../locale'
import { Dialog } from '@essentia/ui'
import { useState, type FormEvent } from 'react'
import { HabitFields } from './HabitFields'
import { formOf, readForm, type FormErrors } from '../domain/habitForm'
import { editId, type Habit, type HabitDraft } from '../domain/habits'
import { LIMITS } from '../data/sync'

interface EditDialogProps {
  habit: Habit
  categories: string[]
  onSave: (draft: HabitDraft) => void
  onClose: () => void
}

/** Edits a habit's settings; its check-ins are kept. */
export function EditDialog({ habit, categories, onSave, onClose }: EditDialogProps) {
  const [form, setForm] = useState(() => formOf(habit))
  const [errors, setErrors] = useState<FormErrors>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = readForm(form)
    if (result.errors) {
      setErrors(result.errors)
      return
    }
    onSave(result.draft)
  }

  return (
    <Dialog title={t("Edit habit")} titleId="edit-title" returnFocusId={editId(habit)} onClose={onClose}>
      <form className="dialog__body" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="edit-name">{t("Name")}</label>
          <input
            id="edit-name"
            className="input"
            value={form.name}
            maxLength={LIMITS.name}
            autoComplete="off"
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name ? 'edit-name-error' : undefined}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value })
              setErrors({ ...errors, name: undefined })
            }}
          />
          {errors.name && (
            <p id="edit-name-error" className="field-error" role="alert">
              {t(errors.name)}
            </p>
          )}
        </div>
        <HabitFields
          idPrefix="edit"
          form={form}
          errors={errors}
          categories={categories}
          onChange={(next) => {
            setForm(next)
            setErrors({ name: errors.name })
          }}
        />
        <div className="dialog__actions">
          <button type="button" className="button-ghost" onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" className="button-primary">{t("Save")}</button>
        </div>
      </form>
    </Dialog>
  )
}
