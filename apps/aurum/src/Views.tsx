export type View = 'transactions' | 'insights' | 'plan'

const VIEW_LABELS: Record<View, string> = {
  transactions: 'Transactions',
  insights: 'Insights',
  plan: 'Plan',
}

interface ViewsProps {
  view: View
  onChange: (view: View) => void
}

export function Views({ view, onChange }: ViewsProps) {
  return (
    <nav className="views" aria-label="Views">
      {(Object.keys(VIEW_LABELS) as View[]).map((value) => (
        <button
          key={value}
          type="button"
          className="views__button"
          aria-current={view === value ? 'page' : undefined}
          onClick={() => onChange(value)}
        >
          {VIEW_LABELS[value]}
        </button>
      ))}
    </nav>
  )
}
