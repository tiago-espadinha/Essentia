import { t } from '../locale'
import { formatNumber } from '@essentia/ui'
import { useMemo, useState } from 'react'
import { INTERVALS, periodTotals, spendingByCategory, type Interval } from '../domain/insights'
import { MonthChart } from './MonthChart'
import { BadgeShelf } from './BadgeShelf'
import type { Budget } from '../domain/budgets'
import type { RecurringItem } from '../domain/recurring'
import { formatMoney } from '../domain/money'
import { fullDate, monthLabel, monthOf, monthsOf, todayKey, totals, type Transaction } from '../domain/transactions'

interface InsightsViewProps {
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringItem[]
  /** False until budgets and recurring items are read, when badges could still change. */
  planReady: boolean
  /** Leads to the add field, the empty view's one action. */
  onAdd: () => void
}

/** One month's totals and spending by category, the weeks or months of an interval side by side, then the badges. */
export function InsightsView({ transactions, budgets, recurring, planReady, onAdd }: InsightsViewProps) {
  const current = monthOf(todayKey())
  const [month, setMonth] = useState(current)

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t("Not enough data yet.")}</p>
        <p className="empty__text">{t("Add a transaction and its month shows up here.")}</p>
        <button type="button" className="button-primary empty__action" onClick={onAdd}>
          {t("Add a transaction")}</button>
      </div>
    )
  }

  const months = [...new Set([current, ...monthsOf(transactions)])].sort().reverse()
  const inMonth = totals(transactions.filter((t) => monthOf(t.date) === month))
  const spending = spendingByCategory(transactions, month)

  return (
    <>
      <section className="insight" aria-labelledby="month-title">
        <div className="section-row">
          <h2 id="month-title" className="label">
            {t("Month")}</h2>
          <span className="section-row__rule" />
        </div>
        <label className="visually-hidden" htmlFor="insight-month">
          {t("Month to show")}</label>
        <select id="insight-month" className="input" value={month} onChange={(event) => setMonth(event.target.value)}>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>
        <dl className="hero__stats">
          <div>
            <dt className="label">{t("Income")}</dt>
            <dd className="amount amount--income">{formatMoney(inMonth.income)}</dd>
          </div>
          <div>
            <dt className="label">{t("Expenses")}</dt>
            <dd className="amount">{formatMoney(inMonth.expenses)}</dd>
          </div>
          <div>
            <dt className="label">{t("Net")}</dt>
            <dd className={`amount${inMonth.balance < 0 ? ' amount--negative' : ''}`}>{formatMoney(inMonth.balance)}</dd>
          </div>
        </dl>
        <h3 className="insight__subtitle">{t("Spending by category")}</h3>
        {spending.length === 0 ? (
          <p className="insight__none">{t("No expenses in {month}.", { month: monthLabel(month) })}</p>
        ) : (
          <ul className="spend">
            {spending.map(({ category, amount, share }) => (
              <li key={category} className="spend__item">
                <span className="spend__name">{category}</span>
                <span className="amount">{formatMoney(amount)}</span>
                <span className="spend__share">{formatNumber(share, { style: 'percent', maximumFractionDigits: 0 })}</span>
                <span className="spend__track" aria-hidden="true">
                  <span className="spend__fill" style={{ width: `${share * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <OverTime transactions={transactions} />
      {planReady && <BadgeShelf transactions={transactions} budgets={budgets} recurring={recurring} />}
    </>
  )
}

const INTERVAL_TEXT: Record<Interval, { option: string; title: string; caption: string; empty: string }> = {
  weeks: {
    option: '12 weeks',
    title: 'Last 12 weeks',
    caption: 'Income, expenses and net for each of the last 12 weeks',
    empty: 'Nothing recorded in the last 12 weeks.',
  },
  months: {
    option: '6 months',
    title: 'Last six months',
    caption: 'Income, expenses and net for each of the last six months',
    empty: 'Nothing recorded in the last six months.',
  },
  year: {
    option: '12 months',
    title: 'Last 12 months',
    caption: 'Income, expenses and net for each of the last 12 months',
    empty: 'Nothing recorded in the last 12 months.',
  },
}

/** The table's name for a bucket: 'Week of 24 Apr 2023' or 'April 2023'. */
const periodName = (period: string, weekly: boolean) =>
  weekly ? t("Week of {day}", { day: fullDate(period) }) : monthLabel(period)

/** The interval's totals as a chart and, holding the same numbers, a table; both follow the chosen interval. */
function OverTime({ transactions }: { transactions: Transaction[] }) {
  const [interval, chooseInterval] = useState<Interval>('months')
  const today = todayKey()
  const periods = useMemo(() => periodTotals(transactions, interval, today), [transactions, interval, today])
  const text = INTERVAL_TEXT[interval]
  const weekly = INTERVALS[interval].unit === 'week'
  const empty = periods.every((p) => p.income === 0 && p.expenses === 0)
  return (
    <section className="insight" aria-labelledby="periods-title">
      <div className="section-row">
        <h2 id="periods-title" className="label">
          {t(text.title)}</h2>
        <span className="section-row__rule" />
      </div>
      <fieldset className="interval">
        <legend className="visually-hidden">{t("Interval to show")}</legend>
        <div className="segmented segmented--three">
          {(Object.keys(INTERVALS) as Interval[]).map((value) => (
            <label key={value} className="segmented__option">
              <input
                type="radio"
                name="insight-interval"
                value={value}
                checked={interval === value}
                onChange={() => chooseInterval(value)}
              />
              <span>{t(INTERVAL_TEXT[value].option)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {empty ? <p className="insight__none">{t(text.empty)}</p> : <MonthChart periods={periods} weekly={weekly} />}
      <div className="months-scroll" role="region" aria-label={t(weekly ? "Weekly totals" : "Monthly totals")} tabIndex={0}>
        <table className="months">
          <caption className="visually-hidden">{t(text.caption)}</caption>
          <thead>
            <tr>
              <th scope="col" className="label">
                {t(weekly ? "Week" : "Month")}</th>
              <th scope="col" className="label">
                {t("In")}</th>
              <th scope="col" className="label">
                {t("Out")}</th>
              <th scope="col" className="label">
                {t("Net")}</th>
            </tr>
          </thead>
          <tbody>
            {[...periods].reverse().map(({ period, income, expenses, balance }) => (
              <tr key={period}>
                <th scope="row">{periodName(period, weekly)}</th>
                <td className="amount amount--income">{formatMoney(income)}</td>
                <td className="amount">{formatMoney(expenses)}</td>
                <td className={`amount${balance < 0 ? ' amount--negative' : ''}`}>{formatMoney(balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
