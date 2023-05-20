import type { ComponentType } from 'react'
import { formatNumber } from '@essentia/ui'
import { t } from './locale'

// A small, made-up glimpse of what each app holds, drawn on its hub card.
// Decorative: the card's link carries the app's name.

const cents = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

function Note() {
  return (
    <div className="hub-sample hub-sample--note">
      <p className="hub-sample__title">{t('Meeting notes')}</p>
      <p>{t('Ship the small thing first,')}</p>
      <p>{t('then ask what is missing.')}</p>
      <p>{t('Draft the outline tonight.')}</p>
      <p>{t('#ideas')}</p>
    </div>
  )
}

const tasks: [string, boolean][] = [
  ['Send invoice', true],
  ['Book dentist', true],
  ['Review draft', false],
  ['Water plants', false],
]

function Tasks() {
  return (
    <ul className="hub-sample hub-sample--tasks">
      {tasks.map(([task, done]) => (
        <li key={task} className={done ? 'is-done' : undefined}>
          <span className="hub-sample__box" />
          {t(task)}
        </li>
      ))}
    </ul>
  )
}

// Five weeks of days; the last few are still to come.
const days = Array.from({ length: 35 }, (_, day) => day < 31 && (day * 5) % 7 < 4)

function Habits() {
  return (
    <div className="hub-sample hub-sample--habits">
      {days.map((done, day) => <span key={day} className={done ? 'is-done' : undefined} />)}
    </div>
  )
}

const entries: [string, number][] = [
  ['Salary', 1850],
  ['Rent', -620],
  ['Groceries', -84.3],
  ['Coffee', -3.2],
]
const left = entries.reduce((sum, [, amount]) => sum + amount, 0)

function Receipt() {
  return (
    <dl className="hub-sample hub-sample--receipt">
      {entries.map(([label, amount]) => (
        <div key={label}>
          <dt>{t(label)}</dt>
          <dd>{formatNumber(amount, { ...cents, signDisplay: 'exceptZero' })}</dd>
        </div>
      ))}
      <div className="hub-sample__total">
        <dt>{t('Left')}</dt>
        <dd>{formatNumber(left, cents)}</dd>
      </div>
    </dl>
  )
}

const samples: Record<string, ComponentType> = { Folio: Note, Acta: Tasks, Virtus: Habits, Merces: Receipt }

export function AppSample({ name }: { name: string }) {
  const Sample = samples[name]
  return Sample ? <div className="hub-card__sample" aria-hidden="true"><Sample /></div> : null
}
