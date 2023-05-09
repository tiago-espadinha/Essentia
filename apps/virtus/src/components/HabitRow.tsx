import { formatHabitAmount } from '../domain/habits'
import { currentLocale, formatNumber } from '@essentia/ui'
import { t } from '../locale'
import { CategoryMarker } from './CategoryMarker'
import { controlId, describeDays, editId, statsId, isDone, isNumeric, MILESTONES, progressOf, streaks, type Habit, type Progress } from '../domain/habits'

interface HabitRowProps {
  habit: Habit
  today: string
  showLongest?: boolean
  onToggle: (id: string) => void
  onOpenLog: (habit: Habit) => void
  onShowStats: (habit: Habit) => void
  onEdit: (habit: Habit) => void
  onDelete: (id: string) => void
}

export function HabitRow({ habit, today, showLongest = false, onToggle, onOpenLog, onShowStats, onEdit, onDelete }: HabitRowProps) {
  const nameId = `habit-${habit.id}-name`
  const done = isDone(habit, today)
  const { current, longest } = streaks(habit, today)
  const numeric = isNumeric(habit)
  const progress = progressOf(habit, today)

  return (
    <li className={`habit${done ? ' habit--done' : ''}`} data-motion-item={habit.id}>
      {numeric ? (
        <button
          id={controlId(habit)}
          type="button"
          className={`habit__mark habit__check habit__log habit__log--${progress}`}
          aria-haspopup="dialog"
          onClick={() => onOpenLog(habit)}
        >
          <span className="visually-hidden">{logLabel(habit, today, progress)}</span>
        </button>
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
          {numeric && <span className="label habit__amount">{amountToday(habit, today)}</span>}
          <span className="label">
            <CategoryMarker category={habit.category} />
            {habit.category}
          </span>
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
      </div>
    </li>
  )
}

/** "3 / 5 km", or "3 km" without a target. */
function amountToday(habit: Habit, today: string): string {
  const logged = formatHabitAmount(habit.log[today] ?? 0)
  return habit.target === null
    ? `${logged} ${habit.unit}`
    : `${logged} / ${formatHabitAmount(habit.target)} ${habit.unit}`
}

/** The check's name states the habit and today's progress, so the state never rests on the glyph alone. */
function logLabel(habit: Habit, today: string, progress: Progress): string {
  const action = t('Log {unit} for “{name}”', { unit: habit.unit, name: habit.name })
  if (progress === 'none') return `${action}, ${t('nothing logged today')}`
  const state = habit.target === null ? t('logged') : t(progress === 'done' ? 'target met' : 'below target')
  return `${action}, ${amountToday(habit, today)} ${t('today')}, ${state}`
}
