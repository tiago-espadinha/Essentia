import { useRef, useState, type FormEvent } from 'react'
import { budgetStatus, type Budget, type BudgetStatus } from './budgets'
import { Field } from './Field'
import { invalid } from './forms'
import { amountText, formatMoney, parseAmount } from './money'
import { categoriesOf, CATEGORIES, cleanCategory, LIMITS, monthLabel, monthOf, todayKey, type Transaction } from './transactions'

interface BudgetsProps {
  budgets: Budget[]
  /** False until the account's budgets have been read. */
  ready: boolean
  transactions: Transaction[]
  onSet: (category: string, amount: number) => void
  onRemove: (category: string) => void
}

interface Errors {
  category?: string
  amount?: string
}

/** A monthly limit per category, set above the list of this month's spending against each. */
export function Budgets({ budgets, ready, transactions, onSet, onRemove }: BudgetsProps) {
  const month = monthOf(todayKey())
  const [form, setForm] = useState({ category: '', amount: '' })
  const [errors, setErrors] = useState<Errors>({})
  // The budget Edit filled the form with; renaming its category moves the limit rather than adding one.
  const [editing, setEditing] = useState<string | null>(null)
  // Said once after each change; the list itself shows the result.
  const [announcement, setAnnouncement] = useState('')
  const categoryRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const expenses = transactions.filter((t) => t.type === 'expense')
  const suggestions = [...new Set([...CATEGORIES.expense, ...categoriesOf(expenses)])]

  function change(changes: Partial<typeof form>) {
    setForm({ ...form, ...changes })
    setErrors({ ...errors, ...Object.fromEntries(Object.keys(changes).map((key) => [key, undefined])) })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const amount = parseAmount(form.amount)
    const found: Errors = {
      category: form.category.trim() ? undefined : 'Name the category this limit is for.',
      amount: amount === null ? 'Enter a monthly limit, like 200 or 150.50.' : undefined,
    }
    if (found.category || found.amount) {
      setErrors(found)
      ;(found.category ? categoryRef : amountRef).current?.focus()
      return
    }
    const category = cleanCategory(form.category)
    if (editing !== null && editing !== category) onRemove(editing)
    onSet(category, amount!)
    setForm({ category: '', amount: '' })
    setEditing(null)
    setAnnouncement(`Budget for ${category} set to ${formatMoney(amount!)} a month.`)
    categoryRef.current?.focus()
  }

  function edit(budget: Budget) {
    setForm({ category: budget.category, amount: amountText(budget.amount) })
    setErrors({})
    setEditing(budget.category)
    amountRef.current?.focus()
  }

  function remove(budget: Budget) {
    onRemove(budget.category)
    if (editing === budget.category) setEditing(null)
    setAnnouncement(`Budget for ${budget.category} removed.`)
    categoryRef.current?.focus()
  }

  return (
    <section className="insight" aria-labelledby="budgets-title">
      <div className="section-row">
        <h2 id="budgets-title" className="label">
          Budgets
        </h2>
        <span className="section-row__rule" />
        <span className="label">{monthLabel(month)}</span>
      </div>
      <form className="budget-form" onSubmit={submit} noValidate>
        <Field id="budget-category" label="Category" error={errors.category}>
          <input
            ref={categoryRef}
            id="budget-category"
            className="input"
            list="budget-categories"
            value={form.category}
            maxLength={LIMITS.category}
            autoComplete="off"
            onChange={(event) => change({ category: event.target.value })}
            {...invalid('budget-category', errors.category)}
          />
          <datalist id="budget-categories">
            {suggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
        <Field id="budget-amount" label="Monthly limit (€)" error={errors.amount}>
          <input
            ref={amountRef}
            id="budget-amount"
            className="input"
            inputMode="decimal"
            value={form.amount}
            autoComplete="off"
            onChange={(event) => change({ amount: event.target.value })}
            {...invalid('budget-amount', errors.amount)}
          />
        </Field>
        <button type="submit" className="button-primary budget-form__button">
          Set budget
        </button>
      </form>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      {!ready ? (
        <div className="skeleton" role="status" aria-label="Loading your budgets">
          <span className="skeleton__line" />
          <span className="skeleton__line" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="empty">
          <p className="empty__title">No budgets yet.</p>
          <p className="empty__text">Set a monthly limit for a category, and this month’s spending shows against it.</p>
        </div>
      ) : (
        <ul className="budgets">
          {budgetStatus(budgets, transactions, month).map((status) => (
            <BudgetItem key={status.category} status={status} onEdit={edit} onRemove={remove} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface BudgetItemProps {
  status: BudgetStatus
  onEdit: (budget: Budget) => void
  onRemove: (budget: Budget) => void
}

function BudgetItem({ status, onEdit, onRemove }: BudgetItemProps) {
  const over = status.left < 0
  return (
    <li className="budget">
      <span className="budget__name">{status.category}</span>
      <span className="amount">
        {formatMoney(status.spent)} <span className="budget__of">of {formatMoney(status.amount)}</span>
      </span>
      <span className="spend__track" aria-hidden="true">
        <span
          className={`spend__fill${over ? ' budget__fill--over' : ''}`}
          style={{ width: `${Math.min(status.spent / status.amount, 1) * 100}%` }}
        />
      </span>
      <span className={`budget__left${over ? ' budget__left--over' : ''}`}>
        {over ? `${formatMoney(-status.left)} over` : `${formatMoney(status.left)} left`}
      </span>
      <span className="budget__actions">
        <button type="button" className="row__action" onClick={() => onEdit(status)}>
          Edit<span className="visually-hidden"> {status.category} budget</span>
        </button>
        <button type="button" className="row__action" onClick={() => onRemove(status)}>
          Remove<span className="visually-hidden"> {status.category} budget</span>
        </button>
      </span>
    </li>
  )
}
