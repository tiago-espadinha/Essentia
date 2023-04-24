import { t } from '../locale'
import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Field } from './Field'
import { invalid } from '../domain/forms'
import { formatSigned } from '../domain/money'
import {
  FREQUENCIES,
  nextAfter,
  nextOnWeekday,
  occurrence,
  weekdayOf,
  WEEKDAYS,
  type Frequency,
  type RecurringFields,
  type RecurringItem,
  type Weekday,
} from '../domain/recurring'
import { readForm, type FormErrors, type TransactionForm } from '../domain/transactionForm'
import { CATEGORIES, isDay, LIMITS, longDate, shortDate, todayKey, weekdayName } from '../domain/transactions'

interface RecurringProps {
  items: RecurringItem[]
  /** False until the account's recurring items have been read. */
  ready: boolean
  onAdd: (fields: RecurringFields) => void
  onPause: (id: string, paused: boolean) => void
  onRemove: (id: string) => void
}

const FREQUENCY_LABELS: Record<Frequency, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

type RecurringForm = TransactionForm & { frequency: Frequency; weekday: Weekday }

const blank = (): RecurringForm => ({
  description: '',
  amount: '',
  type: 'expense',
  category: '',
  date: todayKey(),
  frequency: 'monthly',
  weekday: weekdayOf(todayKey()),
})

const MISMATCH = '{date} is a {actual}, not a {weekday}.'

/** The first few days a weekly item posts, worked out as the server works them out. */
const PREVIEW = 3

/** Items that post themselves when due, each time the app syncs, and the form that adds one. */
export function Recurring({ items, ready, onAdd, onPause, onRemove }: RecurringProps) {
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<FormErrors>({})
  const [announcement, setAnnouncement] = useState<{ key: string; description: string; date?: string } | null>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const today = todayKey()
  const earliest = occurrence(today, 'yearly', -1)
  const weekly = form.frequency === 'weekly'
  // A weekly first day must fall on the chosen weekday: a mismatch is refused, with the next matching day offered.
  const matches = weekly && isDay(form.date) && weekdayOf(form.date) === form.weekday
  const fix = weekly && isDay(form.date) && !matches ? nextOnWeekday(form.date, form.weekday) : null

  function change(changes: Partial<RecurringForm>) {
    setForm({ ...form, ...changes })
    const cleared = { ...errors, ...Object.fromEntries(Object.keys(changes).map((key) => [key, undefined])) }
    // A new weekday or frequency settles a weekday mismatch, whatever comes of it on the next submit.
    if (cleared.date === MISMATCH && ('weekday' in changes || 'frequency' in changes)) cleared.date = undefined
    setErrors(cleared)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = readForm(form)
    // Catching up goes back to the first day; a mistyped year would post decades of items.
    const errors: FormErrors = { ...result.errors }
    if (!errors.date && form.date < earliest) errors.date = 'Choose a day from {date}, {year} on.'
    else if (!errors.date && weekly && !matches) errors.date = MISMATCH
    if (result.errors || errors.date) {
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

  function applyFix(day: string) {
    // Render first, so focus lands on the field already described by its preview, not the old error.
    flushSync(() => change({ date: day }))
    document.getElementById('recurring-date')?.focus()
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
              onChange={(event) => {
                const frequency = event.target.value as Frequency
                // Turning weekly starts from the weekday of the day already chosen.
                const weekday = frequency === 'weekly' && isDay(form.date) ? weekdayOf(form.date) : form.weekday
                change({ frequency, weekday })
              }}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {t(FREQUENCY_LABELS[frequency])}
                </option>
              ))}
            </select>
          </Field>
          {weekly && (
            <Field id="recurring-weekday" label={t("Day of the week")}>
              <select
                id="recurring-weekday"
                className="input"
                value={form.weekday}
                onChange={(event) => change({ weekday: Number(event.target.value) as Weekday })}
              >
                {WEEKDAYS.map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {weekdayName(weekday)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            id="recurring-date"
            label={t(weekly ? "First payment" : "First on")}
            error={
              errors.date &&
              t(errors.date, {
                date: errors.date === MISMATCH ? shortDate(form.date) : shortDate(earliest),
                year: earliest.slice(0, 4),
                actual: isDay(form.date) ? weekdayName(weekdayOf(form.date)) : '',
                weekday: weekdayName(form.weekday),
              })
            }
          >
            <input
              id="recurring-date"
              className="input"
              type="date"
              value={form.date}
              onChange={(event) => change({ date: event.target.value })}
              {...invalid('recurring-date', errors.date, matches ? 'recurring-schedule' : undefined)}
            />
          </Field>
        </div>
        {errors.date === MISMATCH && fix && (
          <button type="button" className="recurring-form__fix" onClick={() => applyFix(fix)}>
            {t('Use {date}', { date: longDate(fix) })}
          </button>
        )}
        {matches && !errors.date && (
          <p id="recurring-schedule" className="recurring-form__hint">
            {t('Posts on {dates}, then every {weekday}.', {
              dates: Array.from({ length: PREVIEW }, (_, n) => shortDate(occurrence(form.date, 'weekly', n))).join(', '),
              weekday: weekdayName(form.weekday),
            })}
          </p>
        )}
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
          <span className="label">
            {item.frequency === 'weekly'
              ? t('Weekly, {weekday}', { weekday: weekdayName(weekdayOf(item.startOn)) })
              : t(FREQUENCY_LABELS[item.frequency])}
          </span>
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
