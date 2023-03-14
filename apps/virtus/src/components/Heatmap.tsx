import { formatNumber } from '@essentia/ui'
import { t } from '../locale'
import { shortDate, type Habit } from '../domain/habits'
import { heatmap, heatWeeks, sumTallies } from '../domain/stats'

interface HeatmapProps {
  habits: Habit[]
  today: string
}

const ROW_LABELS = ['Monday', '', 'Wednesday', '', 'Friday', '', 'Sunday']

/**
 * Twelve week columns, Monday at the top; the shade is the share of due habits done.
 * The grid is drawn for sight; screen readers get the same weeks as a table.
 */
export function Heatmap({ habits, today }: HeatmapProps) {
  const days = heatmap(habits, today)
  const total = sumTallies(days.map((item) => item.tally))
  const full = days.filter((item) => item.level === 4).length

  return (
    <figure className="heatmap">
      <div className="heatmap__grid" aria-hidden="true">
        {ROW_LABELS.map((label, row) => (
          <span key={`label-${row}`} className="heatmap__label" style={{ gridRow: row + 1 }}>
            {label ? t(label)[0]?.toUpperCase() : ''}
          </span>
        ))}
        {days.map((item) => (
          <span
            key={item.day}
            className={`heatmap__cell heatmap__cell--${item.level ?? 'none'}`}
            title={item.tally.due > 0 ? `${shortDate(item.day)}: ${t('{done} of {due}', { done: formatNumber(item.tally.done), due: formatNumber(item.tally.due) })}` : shortDate(item.day)}
          />
        ))}
      </div>
      {/* Tables ignore the hidden class's size and overflow, so a wrapper hides it. */}
      <div className="visually-hidden">
        <table>
          <caption>{t("Due habits done each week")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Week of")}</th>
              <th scope="col">{t("Done")}</th>
              <th scope="col">{t("Days with every habit done")}</th>
            </tr>
          </thead>
          <tbody>
            {heatWeeks(days).map((week) => (
              <tr key={week.start}>
                <th scope="row">{shortDate(week.start)}</th>
                <td>
                  {t('{done} of {due}', { done: formatNumber(week.tally.done), due: formatNumber(week.tally.due) })}
                </td>
                <td>{formatNumber(week.full)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="heatmap__caption">
        <span>
          {t(full === 1 ? '{done} of {due} due days done; every habit done on {count} day.' : '{done} of {due} due days done; every habit done on {count} days.', { done: formatNumber(total.done), due: formatNumber(total.due), count: formatNumber(full) })}
        </span>
        <span className="heatmap__legend" aria-hidden="true">
          {t('Less')}
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className={`heatmap__cell heatmap__cell--${level}`} />
          ))}
          {t('More')}
        </span>
      </figcaption>
    </figure>
  )
}
