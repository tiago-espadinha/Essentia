import { useMemo } from 'react'
import { t } from '../locale'
import { badges, type Badge, type BadgeData, type BadgeIcon } from '../domain/badges'
import { todayKey } from '../domain/transactions'

const ICON_PATHS: Record<BadgeIcon | 'lock', string> = {
  entry: 'M6 3h8v14H6zM8.5 7h3M8.5 10h3M8.5 13h2',
  run: 'M4 5h12v11H4zM4 8.5h12M7.5 3v3M12.5 3v3',
  plan: 'M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM10 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  black: 'm3.5 14 4.5-4.5 3 3 5.5-5.5M12.5 7h4v4',
  lock: 'M6 9V7a4 4 0 1 1 8 0v2M5 9h10v8H5z',
}

/** '37 of 50', or in months '2 of 3 months'; nothing once earned or for a yes-or-no badge. */
function progressText({ earned, progress }: Badge): string | null {
  if (earned || !progress) return null
  const { value, goal, unit } = progress
  return unit === 'months' ? t('{value} of {goal} months', { value, goal }) : t('{value} of {goal}', { value, goal })
}

/** Every finance badge, earned or locked, with how far along the counted ones are. */
export function BadgeShelf({ transactions, budgets, recurring }: BadgeData) {
  const today = todayKey()
  const all = useMemo(() => badges({ transactions, budgets, recurring }, today), [transactions, budgets, recurring, today])
  const earned = all.filter((badge) => badge.earned).length

  return (
    <section className="insight badge-shelf" aria-labelledby="badges-title">
      <div className="section-row">
        <h2 id="badges-title" className="label">{t('Badges')}</h2>
        <span className="section-row__rule" />
        <span className="label">{t('{value} of {goal}', { value: earned, goal: all.length })}</span>
      </div>
      <ul className="badges">
        {all.map((badge) => {
          const progress = progressText(badge)
          return (
            <li key={badge.id} className={`badge${badge.earned ? '' : ' badge--locked'}`}>
              <svg className="badge__icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d={ICON_PATHS[badge.earned ? badge.icon : 'lock']}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="badge__name">{t(badge.name)}</span>
              <span className="badge__description">
                {t(badge.description)}
                <span className="visually-hidden">{badge.earned ? t(', earned') : t(', not earned yet')}</span>
              </span>
              {progress && <span className="badge__progress">{progress}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
