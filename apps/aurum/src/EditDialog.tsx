import { Dialog } from '@essentia/ui'
import { useState, type FormEvent } from 'react'
import { Field } from './Field'
import { invalid } from './forms'
import { formOf, readForm, type FormErrors, type TransactionForm } from './transactionForm'
import { CATEGORIES, editId, LIMITS, type Transaction, type TransactionFields } from './transactions'

interface EditDialogProps {
  transaction: Transaction
  onSave: (fields: TransactionFields) => void
  onClose: () => void
}

export function EditDialog({ transaction, onSave, onClose }: EditDialogProps) {
  const [form, setForm] = useState(() => formOf(transaction))
  const [errors, setErrors] = useState<FormErrors>({})

  function change(changes: Partial<TransactionForm>) {
    setForm({ ...form, ...changes })
    setErrors({ ...errors, ...Object.fromEntries(Object.keys(changes).map((key) => [key, undefined])) })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = readForm(form)
    if (result.errors) {
      setErrors(result.errors)
      const first = (['description', 'amount', 'category', 'date'] as const).find((key) => result.errors[key])
      document.getElementById(`edit-${first}`)?.focus()
      return
    }
    onSave(result.fields)
  }

  return (
    <Dialog title="Edit transaction" titleId="edit-title" returnFocusId={editId(transaction)} onClose={onClose}>
      <form className="dialog__body" onSubmit={submit} noValidate>
        <Field id="edit-description" label="Description" error={errors.description}>
          <input
            id="edit-description"
            className="input"
            value={form.description}
            maxLength={LIMITS.description}
            autoComplete="off"
            onChange={(event) => change({ description: event.target.value })}
            {...invalid('edit-description', errors.description)}
          />
        </Field>
        <fieldset className="field">
          <legend className="label">Type</legend>
          <div className="segmented">
            {(['expense', 'income'] as const).map((type) => (
              <label key={type} className="segmented__option">
                <input
                  type="radio"
                  name="edit-type"
                  value={type}
                  checked={form.type === type}
                  onChange={() => change({ type })}
                />
                <span>{type === 'expense' ? 'Expense' : 'Income'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-row">
          <Field id="edit-amount" label="Amount (€)" error={errors.amount}>
            <input
              id="edit-amount"
              className="input"
              inputMode="decimal"
              value={form.amount}
              autoComplete="off"
              onChange={(event) => change({ amount: event.target.value })}
              {...invalid('edit-amount', errors.amount)}
            />
          </Field>
          <Field id="edit-date" label="Date" error={errors.date}>
            <input
              id="edit-date"
              className="input"
              type="date"
              value={form.date}
              onChange={(event) => change({ date: event.target.value })}
              {...invalid('edit-date', errors.date)}
            />
          </Field>
        </div>
        <Field id="edit-category" label="Category" error={errors.category}>
          <input
            id="edit-category"
            className="input"
            list="edit-categories"
            value={form.category}
            maxLength={LIMITS.category}
            autoComplete="off"
            onChange={(event) => change({ category: event.target.value })}
            {...invalid('edit-category', errors.category)}
          />
          <datalist id="edit-categories">
            {CATEGORIES[form.type].map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
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
