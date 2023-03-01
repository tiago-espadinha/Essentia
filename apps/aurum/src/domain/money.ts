// Money is counted in whole cents, so sums are exact; euros appear only at the
// edges: what the user types, what the table stores, what the page shows.

/** numeric(12, 2) in the table: just under ten billion euros. */
export const MAX_CENTS = 999_999_999_999

/**
 * Cents from what a person types: '3.50', '3,5', '1,234.56', '1.234,56', '2100'.
 * The last '.' or ',' followed by one or two digits is the decimal point, and
 * any other separators group thousands. Null for anything else, for zero, and
 * for more than the table holds.
 */
export function parseAmount(text: string): number | null {
  const value = text.trim().replace(/\s+/g, '')
  if (!/^[\d.,]+$/.test(value) || !/\d/.test(value)) return null
  const point = Math.max(value.lastIndexOf('.'), value.lastIndexOf(','))
  const tail = value.slice(point + 1)
  const decimal = point !== -1 && tail.length >= 1 && tail.length <= 2
  const whole = decimal ? value.slice(0, point) : value
  // Grouping must look like grouping, '1.234.567' yes, '12.34.5' no, and not use the decimal point's mark.
  const grouped = /^[1-9]\d{0,2}(?:([.,])\d{3})(?:\1\d{3})*$/.exec(whole)
  if (!/^\d*$/.test(whole) && !(grouped && (!decimal || grouped[1] !== value[point]))) return null
  const total = Number(whole.replace(/[.,]/g, '') || '0') * 100 + (decimal ? Number(tail.padEnd(2, '0')) : 0)
  return total > 0 && total <= MAX_CENTS ? total : null
}

/** What the table stores: 350 -> 3.5. Exact, since cents fit well inside a double. */
export const toEuros = (cents: number) => cents / 100

/** Cents from a stored amount, which PostgREST may send as a number or a string. Null when it is not one. */
export function fromEuros(value: unknown): number | null {
  const euros = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof euros !== 'number' || !Number.isFinite(euros)) return null
  const cents = Math.round(euros * 100)
  return cents > 0 && cents <= MAX_CENTS ? cents : null
}

const EUR = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

/** 350 -> '€3.50'; a negative amount takes a true minus sign, as signed rows do. */
export function formatMoney(cents: number): string {
  return `${cents < 0 ? '−' : ''}${EUR.format(Math.abs(cents) / 100)}`
}

/** Income with a plus, expenses with a minus: '+€2,100.00', '−€3.50'. */
export function formatSigned(cents: number, type: 'income' | 'expense'): string {
  return `${type === 'income' ? '+' : '−'}${formatMoney(cents)}`
}

/** 350 -> '3.50', the form an amount field is edited in. */
export function amountText(cents: number): string {
  return (cents / 100).toFixed(2)
}
