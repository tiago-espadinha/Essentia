import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts'
import type { MonthTotals } from './insights'

const shortMonth = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return new Date(year, number - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

/** The bars themselves; recharts is large, so this module loads only with the chart. */
export default function MonthBars({ months }: { months: MonthTotals[] }) {
  return (
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
  )
}
