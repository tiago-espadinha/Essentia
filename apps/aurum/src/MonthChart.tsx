import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts'
import type { MonthTotals } from './insights'

const shortMonth = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return new Date(year, number - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

/**
 * Income and expenses side by side for each month, oldest on the left. Hidden
 * from screen readers: the table under it holds the same numbers.
 */
export function MonthChart({ months }: { months: MonthTotals[] }) {
  return (
    <div className="month-chart" aria-hidden="true">
      <p className="month-chart__key label">
        <span className="month-chart__swatch month-chart__swatch--income" /> In
        <span className="month-chart__swatch month-chart__swatch--expenses" /> Out
      </p>
      <ResponsiveContainer width="100%" height={160} initialDimension={{ width: 480, height: 160 }}>
        <BarChart data={months} barGap={2} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="month"
            tickFormatter={shortMonth}
            axisLine={{ className: 'month-chart__baseline' }}
            tickLine={false}
            interval={0}
          />
          <Bar dataKey="income" className="month-chart__income" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expenses" className="month-chart__expenses" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
