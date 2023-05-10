import { formatNumber } from '@essentia/ui'
import { useRef } from 'react'
import { t } from '../locale'
import { activeFilters, SORT_LABELS, type ListQuery, type SortMode } from '../domain/habits'
import { CategoryMarker } from './CategoryMarker'

interface FiltersProps {
  query: ListQuery
  categories: string[]
  /** Held by the app, so the panel stays as it was across views. */
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (query: ListQuery) => void
}

const FILTERS_TOGGLE_ID = 'filters-toggle'
const PANEL_ID = 'filters-panel'

export function Filters({ query, categories, open, onOpenChange, onChange }: FiltersProps) {
  const set = (patch: Partial<ListQuery>) => onChange({ ...query, ...patch })
  const active = activeFilters(query)
  const toggle = useRef<HTMLButtonElement>(null)

  return (
    <div className="filters">
      <button
        type="button"
        ref={toggle}
        id={FILTERS_TOGGLE_ID}
        className="filters__toggle"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => onOpenChange(!open)}
      >
        {t('Search and filter')}
        {active > 0 && (
          <span className="filters__count">
            <span className="visually-hidden">, </span>
            {t('{count} active', { count: formatNumber(active) })}
          </span>
        )}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={PANEL_ID}
        className="filters__panel"
        role="search"
        aria-label={t('Find habits')}
        hidden={!open}
        onKeyDown={(event) => {
          // While an input method composes, Escape only cancels the composition.
          if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
          // Also stops a search field clearing itself: closing keeps every value.
          event.preventDefault()
          onOpenChange(false)
          toggle.current?.focus()
        }}
      >
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
                <CategoryMarker category={category} />
                {category}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
