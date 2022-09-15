import { WEEK, WEEKDAY_NAMES, type Weekday } from './habits'
import type { FormErrors, HabitForm } from './habitForm'

interface HabitFieldsProps {
  /** Prefixes the field ids, so the add form and the edit dialog can coexist. */
  idPrefix: string
  form: HabitForm
  errors: FormErrors
  categories: string[]
  onChange: (form: HabitForm) => void
}

/** Category, schedule and tracking settings, shared by the add options and the edit dialog. */
export function HabitFields({ idPrefix, form, errors, categories, onChange }: HabitFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`
  const set = (patch: Partial<HabitForm>) => onChange({ ...form, ...patch })

  function toggleDay(day: Weekday) {
    set({ days: form.days.includes(day) ? form.days.filter((value) => value !== day) : [...form.days, day] })
  }

  return (
    <div className="fields">
      <div className="field">
        <label className="label" htmlFor={id('category')}>
          Category
        </label>
        <input
          id={id('category')}
          className="input"
          list={id('categories')}
          value={form.category}
          onChange={(event) => set({ category: event.target.value })}
          placeholder="General"
          autoComplete="off"
        />
        <datalist id={id('categories')}>
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor={id('schedule')}>
            Schedule
          </label>
          <select
            id={id('schedule')}
            className="input"
            value={form.everyDay ? 'every' : 'some'}
            onChange={(event) => set({ everyDay: event.target.value === 'every' })}
          >
            <option value="every">Every day</option>
            <option value="some">Some days</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor={id('kind')}>
            Track
          </label>
          <select
            id={id('kind')}
            className="input"
            value={form.numeric ? 'amount' : 'check'}
            onChange={(event) => set({ numeric: event.target.value === 'amount' })}
          >
            <option value="check">Done or not</option>
            <option value="amount">An amount</option>
          </select>
        </div>
      </div>

      {!form.everyDay && (
        <fieldset className="field">
          <legend className="label">Days</legend>
          <div className="days" aria-describedby={errors.days ? id('days-error') : undefined}>
            {WEEK.map((day) => (
              <button
                key={day}
                type="button"
                className="days__day"
                aria-pressed={form.days.includes(day)}
                aria-label={WEEKDAY_NAMES[day]}
                onClick={() => toggleDay(day)}
              >
                {WEEKDAY_NAMES[day].slice(0, 2)}
              </button>
            ))}
          </div>
          {errors.days && (
            <p id={id('days-error')} className="field-error" role="alert">
              {errors.days}
            </p>
          )}
        </fieldset>
      )}

      {form.numeric && (
        <div className="field-row">
          <TextField
            id={id('unit')}
            label="Unit"
            value={form.unit}
            placeholder="pages, minutes…"
            error={errors.unit}
            onChange={(unit) => set({ unit })}
          />
          <TextField
            id={id('target')}
            label="Daily target"
            value={form.target}
            placeholder="Optional"
            inputMode="decimal"
            error={errors.target}
            onChange={(target) => set({ target })}
          />
        </div>
      )}
    </div>
  )
}

interface TextFieldProps {
  id: string
  label: string
  value: string
  placeholder: string
  inputMode?: 'decimal'
  error?: string
  onChange: (value: string) => void
}

function TextField({ id, label, value, placeholder, inputMode, error, onChange }: TextFieldProps) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        aria-invalid={error !== undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
