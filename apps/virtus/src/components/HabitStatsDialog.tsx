import { t } from '../locale'
import { Dialog, formatNumber } from '@essentia/ui'
import { addDays, daysBetween, describeDays, shortDate, statsId, WEEK, WEEKDAY_NAMES, type Habit } from '../domain/habits'
import { HabitHistory } from './HabitHistory'
import { DAY_STATE_LABELS, dayState, percent, summarize } from '../domain/stats'

interface HabitStatsDialogProps {
  habit: Habit
  today: string
  onClose: () => void
}

const format = (value: number) => formatNumber(value, { maximumFractionDigits: 1 })

export function HabitStatsDialog({ habit, today, onClose }: HabitStatsDialogProps) {
  const summary = summarize(habit, today)
  const rate = percent(summary.last30)
  const peak = Math.max(1, ...summary.byWeekday)
  const strip = daysBetween(addDays(today, -29), today).map((day) => ({ day, state: dayState(habit, day, today) }))
  const missed = strip.filter((item) => item.state === 'missed').map((item) => shortDate(item.day))
  const metrics: [string, string][] = [
    ['Current streak', formatNumber(summary.current)],
    ['Best streak', formatNumber(summary.longest)],
    ['Check-ins', formatNumber(summary.checkIns)],
  ]
  if (summary.amounts) {
    metrics.push(
      [t('Total {unit}', { unit: habit.unit }), format(summary.amounts.total)],
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
          <div key={t(label)} className="metrics__item">
            <dt className="label">{t(label)}</dt>
            <dd className="metrics__value">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="strip" aria-labelledby="strip-title">
        <div className="strip__header">
          <h3 id="strip-title" className="label">{t("Last 30 days")}</h3>
          <span className="label">
            {rate === null ? t('Nothing due yet') : t('{done} of {due} due days · {rate}%', { done: formatNumber(summary.last30.done), due: formatNumber(summary.last30.due), rate: formatNumber(rate) })}
          </span>
        </div>
        <ol className="strip__days" aria-hidden="true">
          {strip.map(({ day, state }) => (
            <li key={day} className={`strip__day strip__day--${state}`} title={`${shortDate(day)}: ${t(DAY_STATE_LABELS[state])}`} />
          ))}
        </ol>
        <p className="visually-hidden">{missed.length === 0 ? t('No missed days.') : t('Missed: {dates}.', { dates: missed.join(', ') })}</p>
      </section>

      <section className="by-day" aria-labelledby="by-day-title">
        <h3 id="by-day-title" className="label">{t("Check-ins by weekday")}</h3>
        <ol className="by-day__bars">
          {WEEK.map((day) => (
            <li key={day} className="by-day__bar">
              <span className="by-day__fill" style={{ height: `${(summary.byWeekday[day] / peak) * 100}%` }} />
              <span className="label" aria-hidden="true">
                {t(WEEKDAY_NAMES[day])[0]}
              </span>
              <span className="visually-hidden">
                {t(WEEKDAY_NAMES[day])}: {formatNumber(summary.byWeekday[day])}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <HabitHistory habit={habit} />
    </Dialog>
  )
}
