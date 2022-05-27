import { STATUS_LABELS, type StatusFilter } from './tasks'

interface FiltersProps {
  status: StatusFilter
  category: string | null
  categories: string[]
  onStatusChange: (status: StatusFilter) => void
  onCategoryChange: (category: string | null) => void
}

export function Filters({ status, category, categories, onStatusChange, onCategoryChange }: FiltersProps) {
  return (
    <div className="filters" role="group" aria-label="Filter tasks">
      <div className="filters__status" role="group" aria-label="Status">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            className="filters__status-button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
          >
            {STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      {categories.length > 1 && (
        <div className="filters__categories" role="group" aria-label="Category">
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={category === value}
              onClick={() => onCategoryChange(category === value ? null : value)}
            >
              {value}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
