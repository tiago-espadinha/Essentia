// Transactions as a CSV file: one row each, amounts in euros with a point,
// the type in its own column. Text a spreadsheet would run as a formula is
// written with a leading apostrophe, which reading the file takes off again.
import { amountText, parseAmount } from './money'
import { byDate, cleanCategory, cleanDescription, isDay, LIMITS, type Transaction, type TransactionFields } from './transactions'

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

/** A file over either limit is refused whole; the size is checked before it is read. */
export const IMPORT_LIMITS = { bytes: 1_000_000, rows: 5000 }

/**
 * RFC 4180 records: a quoted field may hold commas, doubled quotes and line
 * breaks. A quote inside an unquoted field is just a character ('55" TV').
 * Null when a quote is never closed, which would swallow the rest of the file.
 */
export function parseRecords(text: string): string[][] | null {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  const endRecord = () => {
    record.push(field)
    records.push(record)
    record = []
    field = ''
  }
  const body = text.startsWith('\uFEFF') ? text.slice(1) : text
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quoted) {
      if (char !== '"') field += char
      else if (body[i + 1] === '"') field += body[++i]
      else quoted = false
    } else if (char === '"' && field === '') quoted = true
    else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && body[i + 1] === '\n') i++
      endRecord()
    } else field += char
  }
  if (quoted) return null
  if (field !== '' || record.length > 0) endRecord()
  return records
}

const isBlank = (record: string[]) => record.every((field) => field.trim() === '')

/** Takes off the apostrophe `cell` put before a formula character. */
const plain = (text: string) => (/^''*[=+\-@\t\r]/.test(text) ? text.slice(1) : text)

export interface SkippedRow {
  /** The file's row, the header being row 1. */
  row: number
  reason: string
}

export type CsvImport = { error: string } | { rows: TransactionFields[]; skipped: SkippedRow[] }

/** Why a row cannot be a transaction, or the transaction it is. */
function readRow(get: (column: (typeof CSV_COLUMNS)[number]) => string): TransactionFields | string {
  const date = get('date').trim()
  if (!isDay(date)) return 'the date is not a day like 2022-11-03.'
  const type = get('type').trim().toLowerCase()
  if (type !== 'income' && type !== 'expense') return 'the type is not income or expense.'
  const amount = parseAmount(get('amount'))
  if (amount === null) return 'the amount is not one above zero, like 3.50.'
  const description = cleanDescription(plain(get('description')))
  if (!description) return 'the description is empty.'
  if (description.length > LIMITS.description) return `the description is over ${LIMITS.description} characters.`
  const category = cleanCategory(plain(get('category')))
  if (category.length > LIMITS.category) return `the category is over ${LIMITS.category} characters.`
  return { date, type, amount, description, category }
}

/**
 * The transactions in a CSV file with the export's columns, in any order and
 * any case. Rows that do not make a transaction are skipped and reported.
 */
export function readCsv(text: string): CsvImport {
  const parsed = parseRecords(text)
  if (!parsed) return { error: 'A quote in the file is never closed. Check the file in a spreadsheet and save it again.' }
  const [header, ...lines] = parsed
  if (!header || isBlank(header)) return { error: 'The file is empty.' }
  const names = header.map((name) => name.trim().toLowerCase())
  const index = Object.fromEntries(CSV_COLUMNS.map((column) => [column, names.indexOf(column)]))
  if (Object.values(index).includes(-1)) return { error: 'The file needs the columns date, type, description, category and amount.' }
  const records = lines.map((record, i) => ({ record, row: i + 2 })).filter(({ record }) => !isBlank(record))
  if (records.length === 0) return { error: 'The file has no transactions in it.' }
  if (records.length > IMPORT_LIMITS.rows)
    return { error: `Keep it to ${IMPORT_LIMITS.rows.toLocaleString('en-US')} transactions per file.` }

  const rows: TransactionFields[] = []
  const skipped: SkippedRow[] = []
  for (const { record, row } of records) {
    const result = readRow((column) => record[index[column]] ?? '')
    if (typeof result === 'string') skipped.push({ row, reason: result })
    else rows.push(result)
  }
  return { rows, skipped }
}
