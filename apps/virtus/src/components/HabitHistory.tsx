import { formatDate, formatNumber } from '@essentia/ui'
import { useEffect, useRef, useState } from 'react'
import { formatHabitAmount, isNumeric, type Habit } from '../domain/habits'
import { ENTRY_STATE_LABELS, groupByMonth, HISTORY_BATCH, historyOf } from '../domain/history'
import { t } from '../locale'

// Day keys are read at local noon, as elsewhere in Virtus, so the shown date is the stored one.
const monthName = (month: string) => formatDate(new Date(`${month}-01T12:00:00`), { month: 'long', year: 'numeric' })
const dayName = (day: string) => formatDate(new Date(`${day}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'short' })
const entryId = (day: string) => `history-day-${day}`

/** Every logged day of a habit, newest first by month, revealed a batch at a time. */
export function HabitHistory({ habit }: { habit: Habit }) {
  const entries = historyOf(habit)
  const [shown, setShown] = useState(HISTORY_BATCH)
  // After "Show older", focus moves to the first entry it revealed.
  const focusDay = useRef<string | null>(null)
  useEffect(() => {
    if (focusDay.current) document.getElementById(entryId(focusDay.current))?.focus()
    focusDay.current = null
  }, [shown])

  const months = groupByMonth(entries, shown)
  const remaining = Math.max(0, entries.length - shown)
  const numeric = isNumeric(habit)

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="strip__header">
        <h3 id="history-title" className="label">{t('History')}</h3>
        {entries.length > 0 && <span className="label">{t(entries.length === 1 ? '{count} day logged' : '{count} days logged', { count: formatNumber(entries.length) })}</span>}
      </div>
      {entries.length === 0 ? (
        <p className="history__empty">{t('No check-ins yet.')}</p>
      ) : (
        months.map(({ month, total, entries: days }) => (
          <section key={month} className="history__month" aria-labelledby={`history-month-${month}`}>
            <h4 id={`history-month-${month}`} className="history__month-title">
              {monthName(month)}{' '}
              <span className="label">{t(total === 1 ? '{count} day' : '{count} days', { count: formatNumber(total) })}</span>
            </h4>
            <ol className="history__entries">
              {days.map(({ day, value, state }) => (
                <li key={day} id={entryId(day)} className="history__entry" tabIndex={-1}>
                  <time dateTime={day}>{dayName(day)}</time>{' '}
                  <span className="history__value">
                    {numeric && <span>{formatHabitAmount(value)} {habit.unit}</span>}
                    {numeric && state && ' '}
                    {state && <span className={`history__state history__state--${state}`}>{t(ENTRY_STATE_LABELS[state])}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
      {remaining > 0 && (
        <button
          type="button"
          className="button-ghost history__more"
          onClick={() => {
            focusDay.current = entries[shown].day
            setShown(shown + HISTORY_BATCH)
          }}
        >
          {t('Show older')}
          <span className="label">· {t('{count} more', { count: formatNumber(remaining) })}</span>
        </button>
      )}
    </section>
  )
}
