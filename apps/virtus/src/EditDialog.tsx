import { useState, type FormEvent } from 'react'
import { Dialog } from './Dialog'
import { HabitFields } from './HabitFields'
import { formOf, readForm, type FormErrors } from './habitForm'
import { editId, type Habit, type HabitDraft } from './habits'

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
    <Dialog title="Edit habit" titleId="edit-title" returnFocusId={editId(habit)} onClose={onClose}>
      <form className="dialog__body" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="edit-name">
            Name
          </label>
          <input
            id="edit-name"
            className="input"
            value={form.name}
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
              {errors.name}
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
          <button type="button" className="button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button-primary">
            Save
          </button>
        </div>
      </form>
    </Dialog>
  )
}
