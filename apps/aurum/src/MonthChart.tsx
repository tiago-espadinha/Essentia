import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { MonthTotals } from './insights'

const MonthBars = lazy(() => import('./MonthBars'))

// Same height as the chart in MonthBars, so the table below never moves.
const placeholder = <div className="month-chart__placeholder" />

/** Offline or after a deploy the chart's file may not load; the table still holds the numbers. */
class ChartFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? placeholder : this.props.children
  }
}

/**
 * Income and expenses side by side for each month, oldest on the left. Hidden
 * from screen readers: the table under it holds the same numbers. While the bars
 * load, an empty box of their height keeps the table from moving.
 */
export function MonthChart({ months }: { months: MonthTotals[] }) {
  return (
    <div className="month-chart" aria-hidden="true">
      <p className="month-chart__key label">
        <span className="month-chart__swatch month-chart__swatch--income" /> In
        <span className="month-chart__swatch month-chart__swatch--expenses" /> Out
      </p>
      <ChartFallback>
        <Suspense fallback={placeholder}>
          <MonthBars months={months} />
        </Suspense>
      </ChartFallback>
    </div>
  )
}
