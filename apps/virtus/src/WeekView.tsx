import { controlId, isNumeric, statsId, weekdayOf, weekOf, WEEKDAY_NAMES, type Habit } from './habits'
import { DAY_STATE_LABELS, dayState } from './stats'

interface WeekViewProps {
  habits: Habit[]
  today: string
  onToggle: (id: string) => void
  onShowStats: (habit: Habit) => void
}

/** This week, Monday first: one row per habit; only today can be checked in. */
export function WeekView({ habits, today, onToggle, onShowStats }: WeekViewProps) {
  const days = weekOf(today)

  return (
    <table className="week">
      <caption className="visually-hidden">This week, by habit</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">Habit</span>
          </th>
          {days.map((day) => (
            <th key={day} scope="col" className="label week__day" aria-current={day === today ? 'date' : undefined}>
              <abbr title={WEEKDAY_NAMES[weekdayOf(day)]}>{WEEKDAY_NAMES[weekdayOf(day)][0]}</abbr>
              <span className="week__date">{Number(day.slice(8))}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {habits.map((habit) => (
          <tr key={habit.id}>
            <th scope="row" className="week__habit">
              <button id={statsId(habit)} type="button" className="week__name" onClick={() => onShowStats(habit)}>
                {habit.name}
                <span className="visually-hidden">, show stats</span>
              </button>
            </th>
            {days.map((day) => {
              const state = dayState(habit, day, today)
              const name = WEEKDAY_NAMES[weekdayOf(day)]
              const amount = isNumeric(habit) ? habit.log[day] : undefined
              return (
                <td key={day} className="week__cell">
                  {day === today && !isNumeric(habit) ? (
                    <input
                      id={controlId(habit)}
                      type="checkbox"
                      className="habit__mark habit__check"
                      checked={state === 'done'}
                      aria-label={`${habit.name}, today`}
                      onChange={() => onToggle(habit.id)}
                    />
                  ) : (
                    <span className={`week__mark week__mark--${state}${amount ? ' week__mark--amount' : ''}`}>
                      {amount && <span aria-hidden="true">{amount}</span>}
                      <span className="visually-hidden">
                        {name}: {DAY_STATE_LABELS[state]}
                        {amount && `, ${amount} ${habit.unit}`}
                      </span>
                    </span>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
