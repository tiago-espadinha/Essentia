import { useState } from 'react'
import { monthlyTotals, spendingByCategory } from './insights'
import { MonthChart } from './MonthChart'
import { formatMoney } from './money'
import { monthLabel, monthOf, monthsOf, todayKey, totals, type Transaction } from './transactions'

interface InsightsViewProps {
  transactions: Transaction[]
  /** Leads to the add field, the empty view's one action. */
  onAdd: () => void
}

/** One month's totals and spending by category, then the last six months side by side. */
export function InsightsView({ transactions, onAdd }: InsightsViewProps) {
  const current = monthOf(todayKey())
  const [month, setMonth] = useState(current)

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Not enough data yet.</p>
        <p className="empty__text">Add a transaction and its month shows up here.</p>
        <button type="button" className="button-primary empty__action" onClick={onAdd}>
          Add a transaction
        </button>
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
            Month
          </h2>
          <span className="section-row__rule" />
        </div>
        <label className="visually-hidden" htmlFor="insight-month">
          Month to show
        </label>
        <select id="insight-month" className="input" value={month} onChange={(event) => setMonth(event.target.value)}>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>
        <dl className="hero__stats">
          <div>
            <dt className="label">Income</dt>
            <dd className="amount amount--income">{formatMoney(inMonth.income)}</dd>
          </div>
          <div>
            <dt className="label">Expenses</dt>
            <dd className="amount">{formatMoney(inMonth.expenses)}</dd>
          </div>
          <div>
            <dt className="label">Net</dt>
            <dd className={`amount${inMonth.balance < 0 ? ' amount--negative' : ''}`}>{formatMoney(inMonth.balance)}</dd>
          </div>
        </dl>
        <h3 className="insight__subtitle">Spending by category</h3>
        {spending.length === 0 ? (
          <p className="insight__none">No expenses in {monthLabel(month)}.</p>
        ) : (
          <ul className="spend">
            {spending.map(({ category, amount, share }) => (
              <li key={category} className="spend__item">
                <span className="spend__name">{category}</span>
                <span className="amount">{formatMoney(amount)}</span>
                <span className="spend__share">{Math.round(share * 100)}%</span>
                <span className="spend__track" aria-hidden="true">
                  <span className="spend__fill" style={{ width: `${share * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SixMonths transactions={transactions} last={current} />
    </>
  )
}

function SixMonths({ transactions, last }: { transactions: Transaction[]; last: string }) {
  const months = monthlyTotals(transactions, last)
  return (
    <section className="insight" aria-labelledby="months-title">
      <div className="section-row">
        <h2 id="months-title" className="label">
          Last six months
        </h2>
        <span className="section-row__rule" />
      </div>
      <MonthChart months={months} />
      <table className="months">
        <thead>
          <tr>
            <th scope="col" className="label">
              Month
            </th>
            <th scope="col" className="label">
              In
            </th>
            <th scope="col" className="label">
              Out
            </th>
            <th scope="col" className="label">
              Net
            </th>
          </tr>
        </thead>
        <tbody>
          {[...months].reverse().map(({ month, income, expenses, balance }) => (
            <tr key={month}>
              <th scope="row">{monthLabel(month)}</th>
              <td className="amount amount--income">{formatMoney(income)}</td>
              <td className="amount">{formatMoney(expenses)}</td>
              <td className={`amount${balance < 0 ? ' amount--negative' : ''}`}>{formatMoney(balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
