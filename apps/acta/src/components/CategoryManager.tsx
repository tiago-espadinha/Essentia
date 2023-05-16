import { Dialog } from '@essentia/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { t } from '../locale'
import { checkRename, DEFAULT_CATEGORY, isDefaultCategory, LIMITS } from '../domain/tasks'

interface CategoryUse {
  name: string
  count: number
}

interface CategoryManagerProps {
  uses: CategoryUse[]
  onMove: (from: string, to: string) => void
}

type Mode = 'rename' | 'remove'

/** A row's button by category name; ids may hold any character but a space. */
const buttonId = (mode: Mode, name: string) => `category-${mode}-${encodeURIComponent(name)}`

const tasksText = (count: number) => t(count === 1 ? '{count} task' : '{count} tasks', { count })

/** Every category in use, each renamed (or merged into another) or removed by moving its tasks to General. */
export function CategoryManager({ uses, onMove }: CategoryManagerProps) {
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState<{ mode: Mode; use: CategoryUse } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // The category the tasks now sit under; its Rename button (or the toggle, for General) takes focus once listed.
  const focusAfter = useRef<string | null>(null)

  useEffect(() => {
    if (focusAfter.current === null) return
    const target = isDefaultCategory(focusAfter.current) ? 'categories-toggle' : buttonId('rename', focusAfter.current)
    document.getElementById(target)?.focus()
    focusAfter.current = null
  })

  function move(from: string, to: string) {
    onMove(from, to)
    setChanging(null)
    focusAfter.current = to
    setAnnouncement(t('Tasks filed under “{from}” are now under “{to}”.', { from, to }))
  }

  return (
    <div className="categories">
      <button
        id="categories-toggle"
        type="button"
        className="categories__toggle"
        aria-expanded={open}
        aria-controls={open ? 'categories-panel' : undefined}
        onClick={() => setOpen(!open)}
      >
        {t('Categories')}
      </button>
      <p className="visually-hidden categories__status" role="status">{announcement}</p>
      {open && (
        <section id="categories-panel" className="categories__panel" aria-labelledby="categories-toggle">
          <p className="categories__intro">
            {t('Renaming a category changes it on every task in it; removing one moves its tasks to General.')}
          </p>
          <ul className="categories__list">
            {uses.map((use) => (
              <li key={use.name} className="categories__row">
                <span className="categories__label">
                  <span className="categories__name">{use.name}</span>
                  <span className="label categories__count">{tasksText(use.count)}</span>
                </span>
                {!isDefaultCategory(use.name) && (
                  <span className="categories__actions">
                    {(['rename', 'remove'] as const).map((mode) => (
                      <button
                        key={mode}
                        id={buttonId(mode, use.name)}
                        type="button"
                        className="task__action"
                        onClick={() => setChanging({ mode, use })}
                      >
                        {t(mode === 'rename' ? 'Rename' : 'Remove')}
                        <span className="visually-hidden"> “{use.name}”</span>
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {changing && (
        <CategoryDialog
          key={changing.mode + changing.use.name}
          {...changing}
          names={uses.map((use) => use.name)}
          onMove={move}
          onClose={() => setChanging(null)}
        />
      )}
    </div>
  )
}

interface CategoryDialogProps {
  mode: Mode
  use: CategoryUse
  names: string[]
  onMove: (from: string, to: string) => void
  onClose: () => void
}

function CategoryDialog({ mode, use, names, onMove, onClose }: CategoryDialogProps) {
  const [value, setValue] = useState(use.name)
  const [error, setError] = useState<string>()
  const check = mode === 'rename' ? checkRename(use.name, value, names) : { name: DEFAULT_CATEGORY, merge: null }
  const title = t(mode === 'rename' ? 'Rename “{name}”' : 'Remove “{name}”', { name: use.name })
  const one = use.count === 1
  const count = use.count

  function submit(event: FormEvent) {
    event.preventDefault()
    if ('error' in check) {
      setError(check.error)
      document.getElementById('category-name')?.focus()
      return
    }
    onMove(use.name, check.name)
  }

  const outcome =
    'error' in check
      ? ''
      : mode === 'remove'
        ? t(one ? '1 task moves to General.' : '{count} tasks move to General.', { count })
        : check.merge
          ? t(one ? '“{to}” already exists, so the two become one: 1 task moves to it.' : '“{to}” already exists, so the two become one: {count} tasks move to it.', { to: check.merge, count })
          : t(one ? '1 task moves to “{to}”.' : '{count} tasks move to “{to}”.', { to: check.name, count })

  return (
    <Dialog title={title} titleId="category-title" returnFocusId={buttonId(mode, use.name)} onClose={onClose}>
      <form className="dialog__body" onSubmit={submit} noValidate>
        {mode === 'rename' && (
          <div className="field">
            <label className="label" htmlFor="category-name">
              {t('New name')}
            </label>
            <input
              id="category-name"
              className="input"
              list="category-names"
              value={value}
              maxLength={LIMITS.category}
              autoComplete="off"
              aria-invalid={error !== undefined}
              aria-describedby={error ? 'category-error category-outcome' : 'category-outcome'}
              onChange={(event) => {
                setValue(event.target.value)
                setError(undefined)
              }}
            />
            <datalist id="category-names">
              {names.filter((name) => name !== use.name).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {error && (
              <p id="category-error" className="field-error" role="alert">
                {t(error)}
              </p>
            )}
          </div>
        )}
        <p id="category-outcome" className="categories__outcome">
          {outcome}
        </p>
        <div className="dialog__actions">
          <button type="button" className="button-ghost" data-autofocus={mode === 'remove' ? '' : undefined} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="button-primary" aria-describedby="category-outcome">
            {t(mode === 'remove' ? 'Move and remove' : 'merge' in check && check.merge ? 'Merge' : 'Rename')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
