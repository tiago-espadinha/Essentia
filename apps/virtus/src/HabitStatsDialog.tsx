import { Dialog } from './Dialog'
import { addDays, daysBetween, describeDays, shortDate, statsId, WEEK, WEEKDAY_NAMES, type Habit } from './habits'
import { DAY_STATE_LABELS, dayState, percent, summarize } from './stats'

interface HabitStatsDialogProps {
  habit: Habit
  today: string
  onClose: () => void
}

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })

export function HabitStatsDialog({ habit, today, onClose }: HabitStatsDialogProps) {
  const summary = summarize(habit, today)
  const rate = percent(summary.last30)
  const peak = Math.max(1, ...summary.byWeekday)
  const strip = daysBetween(addDays(today, -29), today).map((day) => ({ day, state: dayState(habit, day, today) }))
  const missed = strip.filter((item) => item.state === 'missed').map((item) => shortDate(item.day))
  const metrics: [string, string][] = [
    ['Current streak', String(summary.current)],
    ['Best streak', String(summary.longest)],
    ['Check-ins', String(summary.checkIns)],
  ]
  if (summary.amounts) {
    metrics.push(
      [`Total ${habit.unit}`, format(summary.amounts.total)],
      ['Average a day', format(summary.amounts.average)],
      ['Best day', format(summary.amounts.best)],
    )
  }

  return (
    <Dialog title={habit.name} titleId="stats-title" returnFocusId={statsId(habit)} onClose={onClose}>
      <p className="label">
        {habit.category} · {describeDays(habit.days)}
        {habit.unit && ` · ${habit.unit}`}
      </p>

      <dl className="metrics">
        {metrics.map(([label, value]) => (
          <div key={label} className="metrics__item">
            <dt className="label">{label}</dt>
            <dd className="metrics__value">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="strip" aria-labelledby="strip-title">
        <div className="strip__header">
          <h3 id="strip-title" className="label">
            Last 30 days
          </h3>
          <span className="label">
            {rate === null ? 'Nothing due yet' : `${summary.last30.done} of ${summary.last30.due} due days · ${rate}%`}
          </span>
        </div>
        <ol className="strip__days" aria-hidden="true">
          {strip.map(({ day, state }) => (
            <li key={day} className={`strip__day strip__day--${state}`} title={`${day}: ${DAY_STATE_LABELS[state]}`} />
          ))}
        </ol>
        <p className="visually-hidden">{missed.length === 0 ? 'No missed days.' : `Missed: ${missed.join(', ')}.`}</p>
      </section>

      <section className="by-day" aria-labelledby="by-day-title">
        <h3 id="by-day-title" className="label">
          Check-ins by weekday
        </h3>
        <ol className="by-day__bars">
          {WEEK.map((day) => (
            <li key={day} className="by-day__bar">
              <span className="by-day__fill" style={{ height: `${(summary.byWeekday[day] / peak) * 100}%` }} />
              <span className="label" aria-hidden="true">
                {WEEKDAY_NAMES[day][0]}
              </span>
              <span className="visually-hidden">
                {WEEKDAY_NAMES[day]}: {summary.byWeekday[day]}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </Dialog>
  )
}
