import { t } from '../locale'
import { SORT_LABELS, type ListQuery, type SortMode } from '../domain/habits'

interface FiltersProps {
  query: ListQuery
  categories: string[]
  /** The Streaks view has its own order. */
  sortable: boolean
  onChange: (query: ListQuery) => void
}

export function Filters({ query, categories, sortable, onChange }: FiltersProps) {
  const set = (patch: Partial<ListQuery>) => onChange({ ...query, ...patch })

  return (
    <div className="filters" role="search" aria-label={t("Find habits")}>
      <div className="filters__row">
        <label className="visually-hidden" htmlFor="search">{t("Search habits")}</label>
        <input
          id="search"
          type="search"
          className="input filters__search"
          value={query.search}
          placeholder={t("Search habits…")}
          autoComplete="off"
          onChange={(event) => set({ search: event.target.value })}
        />
        {sortable && (
          <>
            <label className="visually-hidden" htmlFor="sort">{t("Sort habits")}</label>
            <select
              id="sort"
              className="input filters__sort"
              value={query.sort}
              onChange={(event) => set({ sort: event.target.value as SortMode })}
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {t(SORT_LABELS[mode])}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {categories.length > 1 && (
        <div className="filters__categories" role="group" aria-label={t("Category")}>
          <button type="button" className="chip" aria-pressed={query.category === null} onClick={() => set({ category: null })}>{t("Any")}</button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className="chip"
              aria-pressed={query.category === category}
              onClick={() => set({ category: query.category === category ? null : category })}
            >
              {category}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
