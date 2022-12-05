import { toCsv } from './csv'
import { todayKey, type Transaction } from './transactions'

interface DataToolsProps {
  transactions: Transaction[]
}

/** Hands the browser a file to save. The byte order mark tells Excel the file is UTF-8. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Revoked once the click has been handled: Safari cancels a download whose URL goes at once.
  setTimeout(() => URL.revokeObjectURL(url))
}

export function DataTools({ transactions }: DataToolsProps) {
  return (
    <section className="insight" aria-labelledby="data-title">
      <div className="section-row">
        <h2 id="data-title" className="label">
          Your data
        </h2>
        <span className="section-row__rule" />
      </div>
      <p className="insight__none">A CSV file of every transaction opens in any spreadsheet.</p>
      <div className="data__actions">
        <button
          type="button"
          className="button-ghost data__button"
          disabled={transactions.length === 0}
          onClick={() => download(`aurum-${todayKey()}.csv`, toCsv(transactions))}
        >
          Export CSV
        </button>
      </div>
    </section>
  )
}
