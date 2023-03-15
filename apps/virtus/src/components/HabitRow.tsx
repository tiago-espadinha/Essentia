import { formatHabitAmount } from '../domain/habits'
import { currentLocale, formatNumber } from '@essentia/ui'
import { t } from '../locale'
import { useState, type FormEvent } from 'react'
import { controlId, describeDays, editId, statsId, isDone, isNumeric, MILESTONES, streaks, type Habit } from '../domain/habits'

interface HabitRowProps {
  habit: Habit
  today: string
  showLongest?: boolean
  onToggle: (id: string) => void
  onLog: (id: string, value: number) => void
  onShowStats: (habit: Habit) => void
  onEdit: (habit: Habit) => void
  onDelete: (id: string) => void
}

export function HabitRow({ habit, today, showLongest = false, onToggle, onLog, onShowStats, onEdit, onDelete }: HabitRowProps) {
  const nameId = `habit-${habit.id}-name`
  const done = isDone(habit, today)
  const { current, longest } = streaks(habit, today)

  return (
    <li className={`habit${done ? ' habit--done' : ''}`} data-motion-item={habit.id}>
      {isNumeric(habit) ? (
        <span className="habit__mark" aria-hidden="true" />
      ) : (
        <input
          id={controlId(habit)}
          type="checkbox"
          className="habit__mark habit__check"
          checked={done}
          onChange={() => onToggle(habit.id)}
          aria-labelledby={nameId}
        />
      )}
      <div className="habit__body">
        <p id={nameId} className="habit__name">
          {habit.name}
        </p>
        <p className="habit__meta">
          <span className="label">{habit.category}</span>
          {habit.days.length > 0 && <span className="label">{describeDays(habit.days)}</span>}
          {current > 0 && (
            <span className="label habit__streak">
              {t(current === 1 || currentLocale() === 'en-GB' ? '{count} day streak' : '{count} days streak', { count: formatNumber(current) })}{MILESTONES.includes(current) && t(' · milestone')}
            </span>
          )}
          {showLongest && <span className="label">{t('Best {count}', { count: formatNumber(longest) })}</span>}
        </p>
        <div className="habit__actions">
          <button id={statsId(habit)} type="button" className="habit__action" onClick={() => onShowStats(habit)}>{t("Stats")}<span className="visually-hidden">{t(' for “{name}”', { name: habit.name })}</span>
          </button>
          <button id={editId(habit)} type="button" className="habit__action" onClick={() => onEdit(habit)}>{t("Edit")}<span className="visually-hidden"> “{habit.name}”</span>
          </button>
          <button type="button" className="habit__action" onClick={() => onDelete(habit.id)}>{t("Delete")}<span className="visually-hidden"> “{habit.name}”</span>
          </button>
        </div>
        {isNumeric(habit) && <AmountLog habit={habit} today={today} onLog={onLog} />}
      </div>
    </li>
  )
}

interface AmountLogProps {
  habit: Habit
  today: string
  onLog: (id: string, value: number) => void
}

/** Adds to today's amount; Clear sets it back to nothing. */
function AmountLog({ habit, today, onLog }: AmountLogProps) {
  const [amount, setAmount] = useState('')
  const [invalid, setInvalid] = useState(false)
  const logged = habit.log[today] ?? 0
  const errorId = `habit-${habit.id}-amount-error`

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setInvalid(true)
      return
    }
    // Rounded to hundredths, so 0.1 + 0.2 reads 0.3.
    onLog(habit.id, Math.round((logged + value) * 100) / 100)
    setAmount('')
    setInvalid(false)
  }

  return (
    <form className="amount" onSubmit={submit} noValidate>
      <p className="amount__today">
        <span className="amount__value">{formatHabitAmount(logged)}</span>
        {habit.target !== null && ` / ${formatHabitAmount(habit.target)}`} {habit.unit} {t('today')}
      </p>
      <div className="amount__row">
        <label className="visually-hidden" htmlFor={controlId(habit)}>
          {t('Add {unit} for “{name}”', { unit: habit.unit, name: habit.name })}
        </label>
        <input
          id={controlId(habit)}
          className="input amount__input"
          value={amount}
          inputMode="decimal"
          autoComplete="off"
          placeholder={`+ ${habit.unit}`}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            setAmount(event.target.value)
            setInvalid(false)
          }}
        />
        <button type="submit" className="button-ghost amount__button">{t("Log")}</button>
        {logged > 0 && (
          <button type="button" className="button-ghost amount__button" onClick={() => onLog(habit.id, 0)}>{t("Clear")}<span className="visually-hidden">{t(' today’s {unit}', { unit: habit.unit })}</span>
          </button>
        )}
      </div>
      <p className="label">{t('Use a point for decimals, for example 1.5.')}</p>
      {invalid && (
        <p id={errorId} className="field-error" role="alert">{t("Use a number above zero.")}</p>
      )}
    </form>
  )
}
