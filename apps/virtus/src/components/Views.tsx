import { t } from '../locale'
import { VIEW_LABELS, type View } from '../domain/views'

interface ViewsProps {
  view: View
  onChange: (view: View) => void
}

export function Views({ view, onChange }: ViewsProps) {
  return (
    <nav className="views" aria-label={t("Views")}>
      {(Object.keys(VIEW_LABELS) as View[]).map((value) => (
        <button
          key={value}
          type="button"
          className="views__button"
          aria-current={view === value ? 'page' : undefined}
          onClick={() => onChange(value)}
        >
          {t(VIEW_LABELS[value])}
        </button>
      ))}
    </nav>
  )
}
