import type { Habit } from './habits'
import { heatmap, sumTallies } from './stats'

interface HeatmapProps {
  habits: Habit[]
  today: string
}

const ROW_LABELS = ['M', '', 'W', '', 'F', '', 'S']

/** Twelve week columns, Monday at the top; the shade is the share of due habits done. */
export function Heatmap({ habits, today }: HeatmapProps) {
  const days = heatmap(habits, today)
  const total = sumTallies(days.map((item) => item.tally))
  const full = days.filter((item) => item.level === 4).length

  return (
    <figure className="heatmap">
      <div className="heatmap__grid" aria-hidden="true">
        {ROW_LABELS.map((label, row) => (
          <span key={`label-${row}`} className="heatmap__label" style={{ gridRow: row + 1 }}>
            {label}
          </span>
        ))}
        {days.map((item) => (
          <span
            key={item.day}
            className={`heatmap__cell heatmap__cell--${item.level ?? 'none'}`}
            title={item.tally.due > 0 ? `${item.day}: ${item.tally.done} of ${item.tally.due}` : item.day}
          />
        ))}
      </div>
      <figcaption className="heatmap__caption">
        <span>
          {total.done} of {total.due} due days done; every habit done on {full} {full === 1 ? 'day' : 'days'}.
        </span>
        <span className="heatmap__legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className={`heatmap__cell heatmap__cell--${level}`} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  )
}
