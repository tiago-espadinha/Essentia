import { formatMoney } from './money'
import type { Totals } from './transactions'

interface HeroProps {
  count: number
  totals: Totals
}

/** Today's date, the balance and what came in and went out, over every transaction. */
export function Hero({ count, totals }: HeroProps) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="hero__day label">{today}</p>
      <h1 id="hero-title" className="hero__title">
        Your <em>money</em>
      </h1>
      <p className="hero__balance">
        <span className="label">Balance</span>
        <span className={`hero__amount${totals.balance < 0 ? ' hero__amount--negative' : ''}`}>{formatMoney(totals.balance)}</span>
      </p>
      <dl className="hero__stats">
        <div>
          <dt className="label">Income</dt>
          <dd className="amount amount--income">{formatMoney(totals.income)}</dd>
        </div>
        <div>
          <dt className="label">Expenses</dt>
          <dd className="amount">{formatMoney(totals.expenses)}</dd>
        </div>
        <div>
          <dt className="label">Transactions</dt>
          <dd className="amount">{count}</dd>
        </div>
      </dl>
    </section>
  )
}
