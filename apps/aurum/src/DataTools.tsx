import { useState, type ChangeEvent } from 'react'
import { IMPORT_LIMITS, readCsv, toCsv, type CsvImport, type SkippedRow } from './csv'
import { todayKey, type Transaction, type TransactionFields } from './transactions'

interface DataToolsProps {
  transactions: Transaction[]
  onImport: (rows: TransactionFields[]) => void
}

type Outcome = { error: string } | { added: number; skipped: SkippedRow[] }

/** The first few skipped rows are listed; more than that is a different file. */
const LISTED = 5

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

async function importFile(file: File): Promise<CsvImport> {
  if (file.size > IMPORT_LIMITS.bytes) return { error: 'The file is over 1 MB. Split it and import each part.' }
  try {
    return readCsv(await file.text())
  } catch {
    return { error: 'Couldn’t read that file. Choose it again.' }
  }
}

export function DataTools({ transactions, onImport }: DataToolsProps) {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    const result = await importFile(file)
    input.value = ''
    setBusy(false)
    if ('error' in result) return setOutcome(result)
    if (result.rows.length > 0) onImport(result.rows)
    setOutcome({ added: result.rows.length, skipped: result.skipped })
  }

  return (
    <section className="insight" aria-labelledby="data-title">
      <div className="section-row">
        <h2 id="data-title" className="label">
          Your data
        </h2>
        <span className="section-row__rule" />
      </div>
      <p className="insight__none">
        A CSV file of every transaction opens in any spreadsheet. Importing adds a file’s rows as new transactions, so the same file twice
        adds them twice.
      </p>
      <div className="data__actions">
        <button
          type="button"
          className="button-ghost data__button"
          disabled={transactions.length === 0}
          onClick={() => download(`aurum-${todayKey()}.csv`, toCsv(transactions))}
        >
          Export CSV
        </button>
        <input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          className="visually-hidden data__file"
          disabled={busy}
          onChange={choose}
        />
        <label htmlFor="import-file" className="button-ghost data__button" aria-disabled={busy}>
          {busy ? 'Importing…' : 'Import CSV'}
        </label>
      </div>
      <ImportOutcome outcome={outcome} />
    </section>
  )
}

/** One live region, always there, so each outcome is announced, an error as much as a success. */
function ImportOutcome({ outcome }: { outcome: Outcome | null }) {
  const failed = outcome !== null && 'error' in outcome
  return (
    <div className={`data__outcome${failed ? ' notice--error' : ''}`} role="status">
      {outcome !== null && ('error' in outcome ? <p>{outcome.error}</p> : <Imported {...outcome} />)}
    </div>
  )
}

function Imported({ added, skipped }: { added: number; skipped: SkippedRow[] }) {
  return (
    <>
      <p>
        {added === 0 ? 'Nothing imported.' : `Imported ${added} transaction${added === 1 ? '' : 's'}.`}
        {skipped.length > 0 && ` Skipped ${skipped.length} row${skipped.length === 1 ? '' : 's'}:`}
      </p>
      {skipped.length > 0 && (
        <ul className="data__skipped">
          {skipped.slice(0, LISTED).map(({ row, reason }) => (
            <li key={row}>
              Row {row}: {reason}
            </li>
          ))}
          {skipped.length > LISTED && <li>and {skipped.length - LISTED} more.</li>}
        </ul>
      )}
    </>
  )
}
