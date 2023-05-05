import { t } from '../locale'
import { Dialog, formatNumber } from '@essentia/ui'
import { useState, type FormEvent } from 'react'
import { addAmount, controlId, formatHabitAmount, MAX_AMOUNT, parseAmount, type Habit } from '../domain/habits'

interface LogDialogProps {
  habit: Habit
  today: string
  onLog: (value: number) => void
  onClose: () => void
}

/** Adds an amount to today's total of a numeric habit; Clear empties the day. */
export function LogDialog({ habit, today, onLog, onClose }: LogDialogProps) {
  const [amount, setAmount] = useState('')
  const [invalid, setInvalid] = useState(false)
  const logged = habit.log[today] ?? 0

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseAmount(amount)
    if (value === null) {
      setInvalid(true)
      return
    }
    onLog(addAmount(logged, value))
    onClose()
  }

  return (
    <Dialog title={t('Log “{name}”', { name: habit.name })} titleId="log-title" returnFocusId={controlId(habit)} onClose={onClose}>
      <form className="dialog__body" onSubmit={submit} noValidate>
        <p className="amount__today">
          <span className="amount__value">{formatHabitAmount(logged)}</span>
          {habit.target !== null && ` / ${formatHabitAmount(habit.target)}`} {habit.unit} {t('today')}
        </p>
        <div className="field">
          <label className="label" htmlFor="log-amount">{t('Add {unit}', { unit: habit.unit })}</label>
          <input
            id="log-amount"
            className="input amount__input"
            value={amount}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={invalid ? 'log-amount-hint log-amount-error' : 'log-amount-hint'}
            onChange={(event) => {
              setAmount(event.target.value)
              setInvalid(false)
            }}
          />
          <p id="log-amount-hint" className="label">{t('Up to 2 decimals, with a point or a comma.')}</p>
          {invalid && (
            <p id="log-amount-error" className="field-error" role="alert">
              {t('Use a number from {min} to {max}.', { min: formatNumber(0.01), max: formatNumber(MAX_AMOUNT) })}
            </p>
          )}
        </div>
        <div className="dialog__actions">
          {logged > 0 && (
            <button
              type="button"
              className="button-ghost amount__clear"
              onClick={() => {
                onLog(0)
                onClose()
              }}
            >{t('Clear today')}</button>
          )}
          <button type="button" className="button-ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="button-primary">{t('Add')}</button>
        </div>
      </form>
    </Dialog>
  )
}
