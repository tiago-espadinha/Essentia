import { formatDate } from '@essentia/ui'
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts'
import type { PeriodTotals } from '../domain/insights'
import { shortDate } from '../domain/transactions'

const shortMonth = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return formatDate(new Date(year, number - 1, 1), { month: 'short' })
}

/**
 * The bars themselves; recharts is large, so this module loads only with the chart.
 * No keyboard layer: the chart is hidden from screen readers, so it must not take focus.
 * Its 160 px height is the placeholder's in aurum.css, which holds the place while it loads.
 * With twelve buckets on a narrow screen, recharts drops labels that would overlap.
 */
export default function MonthBars({ periods, weekly }: { periods: PeriodTotals[]; weekly: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={160} initialDimension={{ width: 480, height: 160 }}>
      <BarChart data={periods} accessibilityLayer={false} barGap={2} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
        <XAxis
          dataKey="period"
          tickFormatter={weekly ? shortDate : shortMonth}
          axisLine={{ className: 'month-chart__baseline' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <Bar dataKey="income" className="month-chart__income" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="expenses" className="month-chart__expenses" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
