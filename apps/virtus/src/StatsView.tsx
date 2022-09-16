import { useState, type ReactNode } from 'react'
import { BadgeShelf } from './BadgeShelf'
import { addDays, type Habit } from './habits'
import { Heatmap } from './Heatmap'
import { bestStreaks, categoryTallies, checkInsSince, percent, sumTallies, tally, type Tally } from './stats'
import { WeeklyChart } from './WeeklyChart'

const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]

interface StatsViewProps {
  habits: Habit[]
  today: string
}

function rateText(value: Tally) {
  const rate = percent(value)
  return rate === null ? '—' : `${rate}%`
}

export function StatsView({ habits, today }: StatsViewProps) {
  const [range, setRange] = useState<Range>(30)

  if (habits.length === 0) {
    return (
      <section className="empty" aria-labelledby="empty-title">
        <h2 id="empty-title" className="empty__title">
          Not enough data yet.
        </h2>
        <p className="empty__text">Add a habit in Today and check it in to see your progress here.</p>
      </section>
    )
  }

  const from = addDays(today, -(range - 1))
  const overall = sumTallies(habits.map((habit) => tally(habit, from, today)))
  const best = bestStreaks(habits, today)
  const tiles: { label: string; value: string; note: string }[] = [
    { label: 'Completion', value: rateText(overall), note: `${overall.done} of ${overall.due} due days` },
    { label: 'Check-ins', value: String(checkInsSince(habits, from, today)), note: `last ${range} days` },
    { label: 'Current best', value: `${best.current!.days}d`, note: best.current!.days > 0 ? best.current!.habit.name : 'no streak yet' },
    { label: 'Best ever', value: `${best.longest!.days}d`, note: best.longest!.days > 0 ? best.longest!.habit.name : 'no streak yet' },
  ]

  return (
    <div className="stats">
      <div className="stats__range" role="group" aria-label="Range">
        {RANGES.map((days) => (
          <button key={days} type="button" className="chip" aria-pressed={range === days} onClick={() => setRange(days)}>
            {days} days
          </button>
        ))}
      </div>

      <dl className="tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="tiles__item">
            <dt className="label">{tile.label}</dt>
            <dd className="tiles__value">{tile.value}</dd>
            <dd className="tiles__note">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <StatsSection id="stats-categories" title={`By category, last ${range} days`}>
        <ul className="categories">
          {categoryTallies(habits, from, today).map(({ category, tally: value }) => (
            <li key={category} className="categories__row">
              <span className="categories__name">{category}</span>
              <span className="categories__track" aria-hidden="true">
                <span className="categories__fill" style={{ width: `${percent(value) ?? 0}%` }} />
              </span>
              <span className="label categories__value">{rateText(value)}</span>
            </li>
          ))}
        </ul>
      </StatsSection>

      <StatsSection id="stats-week" title="Last 7 days">
        <WeeklyChart habits={habits} today={today} />
      </StatsSection>

      <StatsSection id="stats-heatmap" title="Last 12 weeks">
        <Heatmap habits={habits} today={today} />
      </StatsSection>

      <BadgeShelf habits={habits} today={today} />
    </div>
  )
}

function StatsSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="stats__section" aria-labelledby={id}>
      <div className="section-row">
        <h2 id={id} className="label">
          {title}
        </h2>
        <span className="section-row__rule" />
      </div>
      {children}
    </section>
  )
}
