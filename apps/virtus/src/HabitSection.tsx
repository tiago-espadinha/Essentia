import type { ReactNode } from 'react'

interface HabitSectionProps {
  id: string
  title: string
  count: number
  children: ReactNode
}

/** A titled list of habit rows; renders nothing when the list is empty. */
export function HabitSection({ id, title, count, children }: HabitSectionProps) {
  if (count === 0) return null
  return (
    <section aria-labelledby={id}>
      <div className="section-row">
        <h2 id={id} className="label">
          {title}
        </h2>
        <span className="section-row__rule" />
        <span className="label">
          {count}
          <span className="visually-hidden"> {count === 1 ? 'habit' : 'habits'}</span>
        </span>
      </div>
      <ul className="habits">{children}</ul>
    </section>
  )
}
