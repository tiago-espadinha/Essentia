import { t } from '../locale'
import { useRef, useState, type FormEvent } from 'react'
import { Field } from './Field'
import { invalid } from '../domain/forms'
import { formatSigned } from '../domain/money'
import { FREQUENCIES, nextAfter, occurrence, type Frequency, type RecurringFields, type RecurringItem } from '../domain/recurring'
import { readForm, type FormErrors, type TransactionForm } from '../domain/transactionForm'
import { CATEGORIES, LIMITS, shortDate, todayKey } from '../domain/transactions'

interface RecurringProps {
  items: RecurringItem[]
  /** False until the account's recurring items have been read. */
  ready: boolean
  onAdd: (fields: RecurringFields) => void
  onPause: (id: string, paused: boolean) => void
  onRemove: (id: string) => void
}

const FREQUENCY_LABELS: Record<Frequency, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

const blank = (): TransactionForm & { frequency: Frequency } => ({
  description: '',
  amount: '',
  type: 'expense',
  category: '',
  date: todayKey(),
  frequency: 'monthly',
})

/** Items that post themselves when due, each time the app syncs, and the form that adds one. */
export function Recurring({ items, ready, onAdd, onPause, onRemove }: RecurringProps) {
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<FormErrors>({})
  const [announcement, setAnnouncement] = useState<{ key: string; description: string; date?: string } | null>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const today = todayKey()

  function change(changes: Partial<typeof form>) {
    setForm({ ...form, ...changes })
    setErrors({ ...errors, ...Object.fromEntries(Object.keys(changes).map((key) => [key, undefined])) })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = readForm(form)
    // Catching up goes back to the first day; a mistyped year would post decades of items.
    const earliest = occurrence(today, 'yearly', -1)
    const tooEarly = !result.errors && result.fields.date < earliest
    if (result.errors || tooEarly) {
      const errors = result.errors ?? { date: 'Choose a day from {date}, {year} on.' }
      setErrors(errors)
      const first = (['description', 'amount', 'category', 'date'] as const).find((key) => errors[key])
      document.getElementById(`recurring-${first}`)?.focus()
      return
    }
    const { date, ...fields } = result.fields
    onAdd({ ...fields, frequency: form.frequency, startOn: date })
    setForm(blank())
    setAnnouncement(
      date <= today
        ? { key: '{description} added. What has fallen due posts with the next sync.', description: fields.description }
        : { key: '{description} added, first on {date}.', description: fields.description, date },
    )
    descriptionRef.current?.focus()
  }

  function remove(item: RecurringItem) {
    onRemove(item.id)
    setAnnouncement({ key: '{description} deleted. What it already posted stays.', description: item.description })
    descriptionRef.current?.focus()
  }

  return (
    <section className="insight" aria-labelledby="recurring-title">
      <div className="section-row">
        <h2 id="recurring-title" className="label">
          {t("Recurring")}</h2>
        <span className="section-row__rule" />
      </div>
      <p className="visually-hidden" role="status">
        {announcement && t(announcement.key, { description: announcement.description, date: announcement.date ? shortDate(announcement.date) : '' })}
      </p>
      {!ready ? (
        <div className="skeleton" role="status" aria-label={t("Loading your recurring items")}>
          <span className="skeleton__line" />
          <span className="skeleton__line" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t("Nothing recurring yet.")}</p>
          <p className="empty__text">{t("Add rent, a salary or a subscription once, and it posts itself each time it falls due.")}</p>
        </div>
      ) : (
        <ul className="rows">
          {items.map((item) => (
            <RecurringRow
              key={item.id}
              item={item}
              today={today}
              onPause={(paused) => {
                onPause(item.id, paused)
                setAnnouncement({ key: paused ? '{description} paused.' : '{description} resumed.', description: item.description })
              }}
              onRemove={() => remove(item)}
            />
          ))}
        </ul>
      )}
      <form className="recurring-form" onSubmit={submit} noValidate>
        <Field id="recurring-description" label={t("Description")} error={errors.description}>
          <input
            ref={descriptionRef}
            id="recurring-description"
            className="input"
            value={form.description}
            maxLength={LIMITS.description}
            autoComplete="off"
            onChange={(event) => change({ description: event.target.value })}
            {...invalid('recurring-description', errors.description)}
          />
        </Field>
        <fieldset className="field">
          <legend className="label">{t("Type")}</legend>
          <div className="segmented">
            {(['expense', 'income'] as const).map((type) => (
              <label key={type} className="segmented__option">
                <input
                  type="radio"
                  name="recurring-type"
                  value={type}
                  checked={form.type === type}
                  onChange={() => change({ type })}
                />
                <span>{t(type === 'expense' ? 'Expense' : 'Income')}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-row">
          <Field id="recurring-amount" label={t("Amount (€)")} error={errors.amount}>
            <input
              id="recurring-amount"
              className="input"
              inputMode="decimal"
              value={form.amount}
              autoComplete="off"
              onChange={(event) => change({ amount: event.target.value })}
              {...invalid('recurring-amount', errors.amount)}
            />
          </Field>
          <Field id="recurring-category" label={t("Category")} error={errors.category}>
            <input
              id="recurring-category"
              className="input"
              list="recurring-categories"
              value={form.category}
              maxLength={LIMITS.category}
              autoComplete="off"
              onChange={(event) => change({ category: event.target.value })}
              {...invalid('recurring-category', errors.category)}
            />
            <datalist id="recurring-categories">
              {CATEGORIES[form.type].map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="field-row">
          <Field id="recurring-frequency" label={t("Repeats")}>
            <select
              id="recurring-frequency"
              className="input"
              value={form.frequency}
              onChange={(event) => change({ frequency: event.target.value as Frequency })}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {t(FREQUENCY_LABELS[frequency])}
                </option>
              ))}
            </select>
          </Field>
          <Field id="recurring-date" label={t("First on")} error={errors.date && t(errors.date, { date: shortDate(occurrence(today, 'yearly', -1)), year: occurrence(today, 'yearly', -1).slice(0, 4) })}>
            <input
              id="recurring-date"
              className="input"
              type="date"
              value={form.date}
              onChange={(event) => change({ date: event.target.value })}
              {...invalid('recurring-date', errors.date)}
            />
          </Field>
        </div>
        <button type="submit" className="button-ghost">
          {t("Add recurring item")}</button>
      </form>
    </section>
  )
}

interface RecurringRowProps {
  item: RecurringItem
  today: string
  onPause: (paused: boolean) => void
  onRemove: () => void
}

function RecurringRow({ item, today, onPause, onRemove }: RecurringRowProps) {
  return (
    <li className="row">
      <div className="row__body">
        <p className="row__description">{item.description}</p>
        <p className="row__meta">
          <span className="label">{t(FREQUENCY_LABELS[item.frequency])}</span>
          <span className="label">{item.paused ? t('Paused') : t('Next {date}', { date: shortDate(nextAfter(item, today)) })}</span>
          <span className="label">{item.category}</span>
        </p>
      </div>
      <p className={`row__amount amount${item.type === 'income' ? ' amount--income' : ''}`}>
        <span className="visually-hidden">{t(item.type === 'income' ? 'Income' : 'Expense')} </span>
        {formatSigned(item.amount, item.type)}
      </p>
      <div className="row__actions">
        <button type="button" className="row__action" onClick={() => onPause(!item.paused)}>
          {t(item.paused ? 'Resume' : 'Pause')}
          <span className="visually-hidden"> “{item.description}”</span>
        </button>
        <button type="button" className="row__action" onClick={onRemove}>
          {t("Delete")}<span className="visually-hidden"> “{item.description}”</span>
        </button>
      </div>
    </li>
  )
}
