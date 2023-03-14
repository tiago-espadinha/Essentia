import { formatDate, formatNumber } from '@essentia/ui'
import { t } from '../locale'
import { isDone, isScheduled, weekdayOf, weekOf, WEEKDAY_NAMES, type Habit } from '../domain/habits'

interface HeroProps {
  habits: Habit[]
  today: string
}

export function Hero({ habits, today }: HeroProps) {
  const date = formatDate(new Date(`${today}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'short' })
  const due = habits.filter((habit) => isScheduled(habit, today))
  const done = due.filter((habit) => isDone(habit, today)).length
  const progress = due.length > 0 ? Math.round((done / due.length) * 100) : 0

  return (
    <section className="hero" aria-labelledby="virtus-title">
      <p className="label hero__day">{date}</p>
      <h1 id="virtus-title" className="hero__title">{t("Your")} <em>{t("habits")}</em>
      </h1>
      {due.length > 0 && (
        <div className="progress">
          <div
            className="progress__track"
            role="progressbar"
            aria-label={t("Due today, done")}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={t('{done} of {due} done today', { done: formatNumber(done), due: formatNumber(due.length) })}
          >
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="label progress__count">
            {t('{done} of {due} done today', { done: formatNumber(done), due: formatNumber(due.length) })}
          </span>
        </div>
      )}
      {habits.length > 0 && (
        <ol className="week-dots" aria-label={t("This week")}>
          {weekOf(today).map((day) => {
            const checkedIn = habits.some((habit) => (habit.log[day] ?? 0) > 0)
            const name = t(WEEKDAY_NAMES[weekdayOf(day)])
            return (
              <li key={day} className="week-dots__day" aria-current={day === today ? 'date' : undefined}>
                <span aria-hidden="true">{name[0]}</span>
                <span className={`week-dots__dot${checkedIn ? ' week-dots__dot--on' : ''}`} aria-hidden="true" />
                <span className="visually-hidden">
                  {name}: {checkedIn ? t('checked in') : t('no check-ins')}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
