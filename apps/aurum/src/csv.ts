// Transactions as a CSV file: one row each, amounts in euros with a point,
// the type in its own column. Text a spreadsheet would run as a formula is
// written with a leading apostrophe.
import { amountText } from './money'
import { byDate, type Transaction } from './transactions'

export const CSV_COLUMNS = ['date', 'type', 'description', 'category', 'amount'] as const

/**
 * A cell starting with one of these is a formula to Excel, Sheets or LibreOffice.
 * Text that already starts with apostrophes before one gets another, so reading
 * the file back takes off exactly the one added here.
 */
const FORMULA = /^'*[=+\-@\t\r]/

function cell(text: string): string {
  const safe = FORMULA.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Newest first, CRLF line ends as RFC 4180 has them. */
export function toCsv(transactions: Transaction[]): string {
  const rows = [...transactions]
    .sort(byDate)
    .map((t) => [t.date, t.type, cell(t.description), cell(t.category), amountText(t.amount)].join(','))
  return [CSV_COLUMNS.join(','), ...rows].map((line) => `${line}\r\n`).join('')
}
