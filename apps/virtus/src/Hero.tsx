import { isDone, isScheduled, weekdayOf, weekOf, WEEKDAY_NAMES, type Habit } from './habits'

interface HeroProps {
  habits: Habit[]
  today: string
}

export function Hero({ habits, today }: HeroProps) {
  const date = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
  const due = habits.filter((habit) => isScheduled(habit, today))
  const done = due.filter((habit) => isDone(habit, today)).length
  const progress = due.length > 0 ? Math.round((done / due.length) * 100) : 0

  return (
    <section className="hero" aria-labelledby="virtus-title">
      <p className="label hero__day">{date}</p>
      <h1 id="virtus-title" className="hero__title">
        Your <em>habits</em>
      </h1>
      {due.length > 0 && (
        <div className="progress">
          <div
            className="progress__track"
            role="progressbar"
            aria-label="Due today, done"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${done} of ${due.length} done today`}
          >
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="label progress__count">
            {done} of {due.length} done today
          </span>
        </div>
      )}
      {habits.length > 0 && (
        <ol className="week-dots" aria-label="This week">
          {weekOf(today).map((day) => {
            const checkedIn = habits.some((habit) => (habit.log[day] ?? 0) > 0)
            const name = WEEKDAY_NAMES[weekdayOf(day)]
            return (
              <li key={day} className="week-dots__day" aria-current={day === today ? 'date' : undefined}>
                <span aria-hidden="true">{name[0]}</span>
                <span className={`week-dots__dot${checkedIn ? ' week-dots__dot--on' : ''}`} aria-hidden="true" />
                <span className="visually-hidden">
                  {name}: {checkedIn ? 'checked in' : 'no check-ins'}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
