import { addDays, daysBetween, weekdayOf, WEEKDAY_NAMES, type Habit } from './habits'
import { dayTally, withStarts } from './stats'

interface WeeklyChartProps {
  habits: Habit[]
  today: string
}

/** Done out of due for each of the last seven days; an open today shows what is done so far. */
export function WeeklyChart({ habits, today }: WeeklyChartProps) {
  const started = withStarts(habits)
  const days = daysBetween(addDays(today, -6), today).map((day) => ({ day, ...dayTally(started, day, today) }))
  const peak = Math.max(1, ...days.map((item) => item.due))

  return (
    <ol className="chart">
      {days.map(({ day, done, due }) => (
        <li key={day} className="chart__day" aria-current={day === today ? 'date' : undefined}>
          <span className="chart__track" aria-hidden="true">
            <span className="chart__fill" style={{ height: `${(done / peak) * 100}%` }} />
          </span>
          <span className="label" aria-hidden="true">
            {WEEKDAY_NAMES[weekdayOf(day)].slice(0, 2)}
          </span>
          <span className="visually-hidden">
            {WEEKDAY_NAMES[weekdayOf(day)]}: {done} of {due} done
          </span>
        </li>
      ))}
    </ol>
  )
}
