import { Dialog } from '@essentia/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { t } from '../locale'
import { readCategoryName, type CategoryUse } from '../domain/categories'
import { invalid } from '../domain/forms'
import { formatMoney } from '../domain/money'
import { CATEGORIES, DEFAULT_CATEGORY, LIMITS } from '../domain/transactions'
import { Field } from './Field'

interface CategoriesProps {
  uses: CategoryUse[]
  /** False until the account has been read. */
  ready: boolean
  onMove: (from: string, to: string) => void
}

type Mode = 'rename' | 'remove'

/** A row's button by category name; an id may hold any character but a space. */
const buttonId = (mode: Mode, name: string) => `category-${mode}-${encodeURIComponent(name)}`

const count = (n: number, one: string, many: string) => t(n === 1 ? one : many, { count: n })

function usesText(use: CategoryUse): string {
  const parts = []
  if (use.transactions) parts.push(count(use.transactions, '{count} transaction', '{count} transactions'))
  if (use.recurring) parts.push(count(use.recurring, '{count} recurring item', '{count} recurring items'))
  if (use.budget) parts.push(t('{amount} budget', { amount: formatMoney(use.budget.amount) }))
  return parts.join(' · ')
}

/** Every category in use, each renamed or merged into another, or removed by moving its uses elsewhere. */
export function Categories({ uses, ready, onMove }: CategoriesProps) {
  const [changing, setChanging] = useState<{ mode: Mode; use: CategoryUse } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // The category a change filed everything under; its Rename button takes focus once listed.
  const focusAfter = useRef<string | null>(null)

  useEffect(() => {
    if (focusAfter.current === null) return
    document.getElementById(buttonId('rename', focusAfter.current))?.focus()
    focusAfter.current = null
  })

  function move(from: string, to: string) {
    onMove(from, to)
    setChanging(null)
    focusAfter.current = to
    setAnnouncement(t('Everything filed under “{from}” is now under “{to}”.', { from, to }))
  }

  return (
    <section className="insight categories" aria-labelledby="categories-title">
      <div className="section-row">
        <h2 id="categories-title" className="label">
          {t("Categories")}</h2>
        <span className="section-row__rule" />
      </div>
      <p className="categories__intro">
        {t("Renaming a category changes it everywhere it is used; removing one moves its uses to another. Nothing is deleted.")}</p>
      <p className="visually-hidden" role="status">{announcement}</p>
      {!ready ? (
        <div className="skeleton" role="status" aria-label={t("Loading your categories")}>
          <span className="skeleton__line" />
          <span className="skeleton__line" />
        </div>
      ) : uses.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t("No categories yet.")}</p>
          <p className="empty__text">{t("A category shows here once a transaction, recurring item or budget uses it.")}</p>
        </div>
      ) : (
        <ul className="rows">
          {uses.map((use) => (
            <li key={use.name} className="row">
              <div className="row__body">
                <p className="row__description">{use.name}</p>
                <p className="row__meta"><span className="label">{usesText(use)}</span></p>
              </div>
              <div className="row__actions">
                {(['rename', 'remove'] as const).map((mode) => (
                  <button key={mode} id={buttonId(mode, use.name)} type="button" className="row__action" onClick={() => setChanging({ mode, use })}>
                    {t(mode === 'rename' ? 'Rename' : 'Remove')}<span className="visually-hidden"> “{use.name}”</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {changing && (
        <CategoryDialog
          key={changing.mode + changing.use.name}
          {...changing}
          uses={uses}
          onMove={move}
          onClose={() => setChanging(null)}
        />
      )}
    </section>
  )
}

interface CategoryDialogProps {
  mode: Mode
  use: CategoryUse
  uses: CategoryUse[]
  onMove: (from: string, to: string) => void
  onClose: () => void
}

function CategoryDialog({ mode, use, uses, onMove, onClose }: CategoryDialogProps) {
  const others = uses.filter((other) => other.name !== use.name)
  const targets = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income, ...others.map((other) => other.name)])]
    .filter((name) => name !== use.name)
    .sort((a, b) => a.localeCompare(b))
  const [value, setValue] = useState(mode === 'rename' ? use.name : use.name === DEFAULT_CATEGORY ? targets[0] : DEFAULT_CATEGORY)
  const [error, setError] = useState<string>()
  const read = mode === 'rename' ? readCategoryName(value, use.name) : { name: value }
  const to = read.name
  const target = others.find((other) => other.name === to)
  const title = t(mode === 'rename' ? 'Rename “{name}”' : 'Remove “{name}”', { name: use.name })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (to === undefined) {
      setError(read.error)
      document.getElementById('category-name')?.focus()
      return
    }
    onMove(use.name, to)
  }

  return (
    <Dialog title={title} titleId="category-title" returnFocusId={buttonId(mode, use.name)} onClose={onClose}>
      <form className="dialog__body" onSubmit={submit} noValidate>
        {mode === 'rename' ? (
          <Field id="category-name" label={t("New name")} error={error && t(error)}>
            <input
              id="category-name"
              className="input"
              list="category-names"
              value={value}
              maxLength={LIMITS.category}
              autoComplete="off"
              onChange={(event) => {
                setValue(event.target.value)
                setError(undefined)
              }}
              {...invalid('category-name', error, 'category-outcome')}
            />
            <datalist id="category-names">
              {others.map((other) => (
                <option key={other.name} value={other.name} />
              ))}
            </datalist>
          </Field>
        ) : (
          <Field id="category-target" label={t("Move its uses to")}>
            <select id="category-target" className="input" value={value} onChange={(event) => setValue(event.target.value)} aria-describedby="category-outcome">
              {targets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <p id="category-outcome" className="categories__outcome" aria-live={mode === 'remove' ? 'polite' : undefined}>
          {to !== undefined && outcome(use, to, target)}
        </p>
        <div className="dialog__actions">
          <button type="button" className="button-ghost" onClick={onClose}>
            {t("Cancel")}</button>
          <button type="submit" className="button-primary">
            {t(mode === 'remove' ? 'Move and remove' : target ? 'Merge' : 'Rename')}</button>
        </div>
      </form>
    </Dialog>
  )
}

/** What confirming will do, said before it is done. */
function outcome(use: CategoryUse, to: string, target: CategoryUse | undefined): string {
  const lines = [t('Moves to “{to}”: {uses}.', { to, uses: usesText(use) })]
  if (target) lines.push(t('“{to}” already exists, so the two become one category.', { to }))
  if (target?.budget && use.budget) {
    lines.push(t('“{to}” keeps its {amount} budget; the {old} budget of “{from}” goes.', {
      to,
      amount: formatMoney(target.budget.amount),
      old: formatMoney(use.budget.amount),
      from: use.name,
    }))
  }
  return lines.join(' ')
}
