import { badges, type BadgeIcon } from './badges'
import type { Habit } from './habits'

interface BadgeShelfProps {
  habits: Habit[]
  today: string
}

const ICON_PATHS: Record<BadgeIcon | 'lock', string> = {
  leaf: 'M5 15c0-6 4-10 10-10 0 6-4 10-10 10Zm0 0 5-5',
  check: 'm5 10.5 3 3 7-7',
  flame: 'M10 17c-3 0-5-2-5-5 0-3 3-4 3-8 3 1 4 4 4 6 1 0 2-1 2-2 1 1 1 2 1 4 0 3-2 5-5 5Z',
  sun: 'M10 6.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4',
  lock: 'M6 9V7a4 4 0 1 1 8 0v2M5 9h10v8H5z',
}

export function BadgeShelf({ habits, today }: BadgeShelfProps) {
  const all = badges(habits, today)
  const earned = all.filter((badge) => badge.earned).length

  return (
    <section className="stats__section" aria-labelledby="stats-badges">
      <div className="section-row">
        <h2 id="stats-badges" className="label">
          Badges
        </h2>
        <span className="section-row__rule" />
        <span className="label">
          {earned} of {all.length}
        </span>
      </div>
      <ul className="badges">
        {all.map((badge) => (
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
            <span className="badge__name">{badge.name}</span>
            <span className="badge__description">
              {badge.description}
              <span className="visually-hidden">{badge.earned ? ', earned' : ', not earned yet'}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
