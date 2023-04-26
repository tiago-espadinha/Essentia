import { t } from '../locale'
import { formatNumber } from '@essentia/ui'
import { useState, type ChangeEvent } from 'react'
import { IMPORT_LIMITS, readCsv, toCsv, type CsvImport, type SkippedRow } from '../domain/csv'
import { fullDate, todayKey, type Transaction, type TransactionFields } from '../domain/transactions'

interface DataToolsProps {
  transactions: Transaction[]
  /** Every transaction on the account, newest first, or null when the account could not be read. */
  onExport: () => Promise<Transaction[] | null>
  onImport: (rows: TransactionFields[]) => void
}

type Outcome =
  | { error: string }
  | { note: string }
  | { added: number; skipped: SkippedRow[] }
  | { exported: number; from: string; to: string }

/** Why an export saved no file; a file the account could not vouch for is no backup. */
const EXPORT_FAILED = 'Couldn’t reach your account, so no file was saved: it might have missed transactions. Try again later.'

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

export function DataTools({ transactions, onExport, onImport }: DataToolsProps) {
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function exportAll() {
    if (exporting) return
    setExporting(true)
    setOutcome(null)
    const all = await onExport()
    setExporting(false)
    if (all === null) return setOutcome({ error: EXPORT_FAILED })
    if (all.length === 0) return setOutcome({ note: 'Your account has no transactions to export.' })
    try {
      download(`merces-${todayKey()}.csv`, toCsv(all))
    } catch {
      return setOutcome({ error: 'Couldn’t save the file. Try again.' })
    }
    setOutcome({ exported: all.length, from: all[all.length - 1].date, to: all[0].date })
  }

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
          {t("Your data")}</h2>
        <span className="section-row__rule" />
      </div>
      <p className="insight__none">
        <span id="data-export-about">
          {t('Export saves every transaction on your account, from all dates and regardless of filters, as a CSV file that opens in any spreadsheet.')}
        </span>{' '}
        {t('Importing adds a file’s rows as new transactions, so the same file twice adds them twice.')}
      </p>
      <div className="data__actions">
        {/* Not disabled while exporting: a disabled button drops the focus it holds. */}
        <button
          type="button"
          className="button-ghost data__button"
          aria-describedby="data-export-about"
          disabled={transactions.length === 0}
          aria-disabled={exporting}
          onClick={() => void exportAll()}
        >
          {t(exporting ? 'Exporting…' : 'Export CSV')}
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
          {t(busy ? 'Importing…' : 'Import CSV')}
        </label>
      </div>
      <OutcomeRegion outcome={outcome} />
    </section>
  )
}

/** One live region, always there, so each outcome is announced, an error as much as a success. */
function OutcomeRegion({ outcome }: { outcome: Outcome | null }) {
  const failed = outcome !== null && 'error' in outcome
  return (
    <div className={`data__outcome${failed ? ' notice--error' : ''}`} role="status">
      {outcome !== null && <OutcomeText outcome={outcome} />}
    </div>
  )
}

function OutcomeText({ outcome }: { outcome: Outcome }) {
  if ('error' in outcome) return <p>{t(outcome.error)}</p>
  if ('note' in outcome) return <p>{t(outcome.note)}</p>
  if ('exported' in outcome) return <Exported {...outcome} />
  return <Imported {...outcome} />
}

/** The count and the span of dates, so the file can be told whole at a glance. */
function Exported({ exported, from, to }: { exported: number; from: string; to: string }) {
  const count = formatNumber(exported)
  const message =
    exported === 1
      ? 'Exported {count} transaction, dated {from}.'
      : from === to
        ? 'Exported {count} transactions, dated {from}.'
        : 'Exported {count} transactions, dated {from} to {to}.'
  return <p>{t(message, { count, from: fullDate(from), to: fullDate(to) })}</p>
}

function Imported({ added, skipped }: { added: number; skipped: SkippedRow[] }) {
  return (
    <>
      <p>
        {added === 0 ? t('Nothing imported.') : t(added === 1 ? 'Imported {count} transaction.' : 'Imported {count} transactions.', { count: formatNumber(added) })}
        {skipped.length > 0 && <>{' '}{t(skipped.length === 1 ? 'Skipped {count} row:' : 'Skipped {count} rows:', { count: formatNumber(skipped.length) })}</>}
      </p>
      {skipped.length > 0 && (
        <ul className="data__skipped">
          {skipped.slice(0, LISTED).map(({ row, reason }) => (
            <li key={row}>
              {t("Row {row}: {reason}", { row: formatNumber(row), reason: t(reason) })}
            </li>
          ))}
          {skipped.length > LISTED && <li>{t("and {count} more.", { count: formatNumber(skipped.length - LISTED) })}</li>}
        </ul>
      )}
    </>
  )
}
