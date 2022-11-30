import { monthLabel, type TransactionFilter, type TransactionType } from './transactions'

const TYPES: { value: TransactionType | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
]

interface FiltersProps {
  filter: TransactionFilter
  categories: string[]
  months: string[]
  onChange: (filter: TransactionFilter) => void
}

export function Filters({ filter, categories, months, onChange }: FiltersProps) {
  const set = (patch: Partial<TransactionFilter>) => onChange({ ...filter, ...patch })

  return (
    <div className="filters" role="search" aria-label="Find transactions">
      <div className="filters__types" role="group" aria-label="Type">
        {TYPES.map(({ value, label }) => (
          <button key={label} type="button" className="filters__type" aria-pressed={filter.type === value} onClick={() => set({ type: value })}>
            {label}
          </button>
        ))}
      </div>
      <label className="visually-hidden" htmlFor="search">
        Search transactions
      </label>
      <input
        id="search"
        type="search"
        className="input"
        value={filter.query}
        placeholder="Search transactions…"
        autoComplete="off"
        onChange={(event) => set({ query: event.target.value })}
      />
      <div className="filters__row">
        <div className="field">
          <label className="label" htmlFor="filter-category">
            Category
          </label>
          <select
            id="filter-category"
            className="input"
            value={filter.category ?? ''}
            onChange={(event) => set({ category: event.target.value || null })}
          >
            <option value="">Any category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="filter-month">
            Month
          </label>
          <select id="filter-month" className="input" value={filter.month ?? ''} onChange={(event) => set({ month: event.target.value || null })}>
            <option value="">Any month</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
